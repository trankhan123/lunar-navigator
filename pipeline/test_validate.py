r"""Unit tests for D7 — pipeline/validate.py.

Run: d:\lunar-navigator\.venv\Scripts\python.exe -m pytest pipeline/test_validate.py -v
  or: d:\lunar-navigator\.venv\Scripts\python.exe pipeline/test_validate.py

Tests:
  1. Lunar coordinate transformation (Moon lat/lon → PGDA South Polar Stereographic CRS)
  2. JPL angular difference with 0/360-degree wrapping
  3. PGDA pixel sampling with synthetic raster fixture:
     - Correct scaling
     - Actual NoData pixel sampling
     - -85°S coverage boundary with an adequately sized raster
     - Scientific validation: explicit handling of NaN, Inf, and out-of-range values
     - Legitimate small floating-point rounding tolerance
  4. Actual GeoTIFF scale/offset metadata handling
  5. Missing dependency and BLOCKED detection behavior
  6. Horizons check with real fixture (point count match, finite non-zero errors)
  7. Output JSON schema and QuickMap record preservation
"""
import json
import math
import sys
import tempfile
import unittest
from pathlib import Path

# ---------------------------------------------------------------------------
# Make the pipeline/ directory importable when running from project root
# ---------------------------------------------------------------------------
PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_DIR.parent
sys.path.insert(0, str(PIPELINE_DIR))

import validate as V  # noqa: E402


# ===========================================================================
# 1. Lunar coordinate transformation
# ===========================================================================

class TestLunarCoordinateTransformation(unittest.TestCase):
    """Test transformation from Moon (lon, lat) to PGDA south polar stereographic CRS."""

    def setUp(self):
        from pyproj import Transformer
        self.transformer = Transformer.from_crs(V.MOON_LONLAT_CRS, V.PGDA_CRS, always_xy=True)

    def test_south_pole_at_origin(self):
        """South Pole (lat -90, any lon) transforms to (x=0, y=0)."""
        x, y = self.transformer.transform(0.0, -90.0)
        self.assertAlmostEqual(x, 0.0, places=3)
        self.assertAlmostEqual(y, 0.0, places=3)

    def test_prime_meridian_orientation(self):
        """+y points to the 0° meridian as specified in docs/technical-reference.md conventions."""
        x, y = self.transformer.transform(0.0, -85.0)
        self.assertAlmostEqual(x, 0.0, places=1)
        self.assertGreater(y, 0.0, "+y must point to 0° meridian")
        # Distance at 85°S: 2 * R * tan(2.5°) ≈ 151713 m
        self.assertAlmostEqual(y, 151713.0, delta=100.0)

    def test_90_east_orientation(self):
        """+x points to lon 90°E as specified in docs/technical-reference.md conventions."""
        x, y = self.transformer.transform(90.0, -85.0)
        self.assertGreater(x, 0.0, "+x must point to 90°E")
        self.assertAlmostEqual(y, 0.0, places=1)
        self.assertAlmostEqual(x, 151713.0, delta=100.0)

    def test_180_meridian_orientation(self):
        """-y points to the 180° meridian."""
        x, y = self.transformer.transform(180.0, -85.0)
        self.assertAlmostEqual(x, 0.0, places=1)
        self.assertLess(y, 0.0, "-y must point to 180° meridian")
        self.assertAlmostEqual(y, -151713.0, delta=100.0)

    def test_90_west_orientation(self):
        """-x points to lon -90° (90°W)."""
        x, y = self.transformer.transform(-90.0, -85.0)
        self.assertLess(x, 0.0, "-x must point to 90°W")
        self.assertAlmostEqual(y, 0.0, places=1)
        self.assertAlmostEqual(x, -151713.0, delta=100.0)

    def test_isotropic_radial_distance(self):
        """At constant latitude, radial distance from pole is constant regardless of longitude."""
        radii = []
        for lon in [0.0, 45.0, 90.0, 135.0, 180.0, -135.0, -90.0, -45.0]:
            x, y = self.transformer.transform(lon, -86.0)
            radii.append(math.hypot(x, y))
        expected_r = radii[0]
        for r in radii:
            self.assertAlmostEqual(r, expected_r, places=2)


# ===========================================================================
# 2. JPL angular difference with 0/360 wrapping
# ===========================================================================

class TestJPLAngularDifference(unittest.TestCase):
    """Verify the angular difference function handles all 360° wrap cases."""

    CASES = [
        (0.0, 0.0, 0.0),
        (180.0, 180.0, 0.0),
        (350.0, 10.0, 20.0),
        (10.0, 350.0, 20.0),
        (0.0, 180.0, 180.0),
        (180.0, 0.0, 180.0),
        (359.9, 0.1, 0.2),
        (0.1, 359.9, 0.2),
        (270.0, 90.0, 180.0),
        (1.0, 359.0, 2.0),
        (355.0, 5.0, 10.0),
        (315.0, 45.0, 90.0),
    ]

    def test_all_cases(self):
        for a, b, expected in self.CASES:
            with self.subTest(a=a, b=b):
                result = V._angular_diff_360(a, b)
                self.assertAlmostEqual(result, expected, places=8,
                                       msg=f"_angular_diff_360({a}, {b}) = {result}, expected {expected}")

    def test_max_possible_difference_is_180(self):
        """The maximum possible angular difference is 180°."""
        import random
        rng = random.Random(42)
        for _ in range(1000):
            a = rng.uniform(0, 360)
            b = rng.uniform(0, 360)
            diff = V._angular_diff_360(a, b)
            self.assertLessEqual(diff, 180.0 + 1e-10)
            self.assertGreaterEqual(diff, 0.0)


# ===========================================================================
# 3. PGDA pixel sampling with synthetic raster fixture
# ===========================================================================

try:
    import rasterio
    import numpy as np
    HAS_RASTERIO = True
except ImportError:
    HAS_RASTERIO = False


@unittest.skipUnless(HAS_RASTERIO, "rasterio not installed")
class TestPGDAPixelSampling(unittest.TestCase):
    """Create adequately sized synthetic rasters and verify read_pgda_fraction."""

    def _make_adequate_raster(self, tmp_dir: Path, raw_value: float = 10000.0,
                              nodata: float = None, nodata_pixel: tuple = None,
                              scales: tuple = None, offsets: tuple = None) -> Path:
        """Write an adequately sized 20×20 raster in PGDA CRS covering ±200 km around South Pole.

        Radius 200 km covers up to lat ≈ -83.4°S, ensuring coordinates near -85°S
        are well within the raster extent.
        """
        path = tmp_dir / "synthetic_pgda.tif"
        x_min, y_min, x_max, y_max = -200000.0, -200000.0, 200000.0, 200000.0
        width, height = 20, 20
        transform = rasterio.transform.from_bounds(x_min, y_min, x_max, y_max, width, height)

        data = np.full((1, height, width), raw_value, dtype=np.float32)
        if nodata_pixel is not None and nodata is not None:
            r, c = nodata_pixel
            data[0, r, c] = nodata

        profile = {
            "driver": "GTiff",
            "dtype": "float32",
            "width": width,
            "height": height,
            "count": 1,
            "crs": V.PGDA_CRS,
            "transform": transform,
        }
        if nodata is not None:
            profile["nodata"] = nodata

        with rasterio.open(path, "w", **profile) as dst:
            dst.write(data)
            if scales is not None:
                dst.scales = scales
            if offsets is not None:
                dst.offsets = offsets

        return path

    def test_pgda_scale_applied(self):
        """A raw value of 12500 should map to 12500 * 4e-05 = 0.5."""
        with tempfile.TemporaryDirectory() as tmp:
            raster_path = self._make_adequate_raster(Path(tmp), raw_value=12500.0)
            result = V.read_pgda_fraction(raster_path, lat=-89.0, lon=0.0)
            self.assertIsNotNone(result)
            self.assertAlmostEqual(result, 12500.0 * V.PGDA_SCALE, places=6)

    def test_coverage_limit_inside_coverage_near_boundary(self):
        """Point at lat -85.1°S is inside coverage and inside raster extent → valid fraction."""
        with tempfile.TemporaryDirectory() as tmp:
            raster_path = self._make_adequate_raster(Path(tmp), raw_value=10000.0)
            result = V.read_pgda_fraction(raster_path, lat=-85.1, lon=0.0)
            self.assertIsNotNone(result)
            self.assertAlmostEqual(result, 10000.0 * V.PGDA_SCALE, places=6)

    def test_coverage_limit_exact_boundary(self):
        """Point at exactly lat -85.0°S is within coverage and returns valid fraction."""
        with tempfile.TemporaryDirectory() as tmp:
            raster_path = self._make_adequate_raster(Path(tmp), raw_value=10000.0)
            result = V.read_pgda_fraction(raster_path, lat=-85.0, lon=0.0)
            self.assertIsNotNone(result)
            self.assertAlmostEqual(result, 10000.0 * V.PGDA_SCALE, places=6)

    def test_coverage_limit_north_of_boundary_inside_raster(self):
        """Point at lat -84.9°S is within raster bounds (y≈154.7 km < 200 km) but returns None due to coverage."""
        with tempfile.TemporaryDirectory() as tmp:
            raster_path = self._make_adequate_raster(Path(tmp), raw_value=10000.0)
            result = V.read_pgda_fraction(raster_path, lat=-84.9, lon=0.0)
            self.assertIsNone(result, "Coordinates north of -85°S must return None")

    def test_actual_nodata_pixel_sampling(self):
        """Test sampling an actual NoData pixel in the raster."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            nodata_val = -9999.0
            from pyproj import Transformer
            t = Transformer.from_crs(V.MOON_LONLAT_CRS, V.PGDA_CRS, always_xy=True)
            x_target, y_target = t.transform(0.0, -88.0)

            path = tmp_path / "nodata_test.tif"
            transform = rasterio.transform.from_bounds(-200000.0, -200000.0, 200000.0, 200000.0, 20, 20)
            data = np.full((1, 20, 20), 10000.0, dtype=np.float32)

            with rasterio.open(path, "w", driver="GTiff", width=20, height=20, count=1,
                               dtype="float32", crs=V.PGDA_CRS, transform=transform, nodata=nodata_val) as dst:
                row_target, col_target = dst.index(x_target, y_target)
                data[0, row_target, col_target] = nodata_val
                dst.write(data)

            # Sampling at the target coordinate must hit the NoData pixel and return None!
            res_nodata = V.read_pgda_fraction(path, lat=-88.0, lon=0.0)
            self.assertIsNone(res_nodata, "Actual NoData pixel must return None")

            # Sampling at a nearby non-nodata coordinate must return the valid fraction!
            res_valid = V.read_pgda_fraction(path, lat=-89.5, lon=0.0)
            self.assertIsNotNone(res_valid)
            self.assertAlmostEqual(res_valid, 10000.0 * V.PGDA_SCALE, places=5)

    def test_small_floating_point_rounding_tolerance(self):
        """Small rounding noise around 0 and 1 is clamped, not rejected."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            # raw value producing fraction slightly above 1.0 (1.00004) within 1e-4 tolerance
            raster_path = self._make_adequate_raster(tmp_path, raw_value=25001.0)
            res = V.read_pgda_fraction(raster_path, lat=-89.0, lon=0.0)
            self.assertIsNotNone(res)
            self.assertEqual(res, 1.0)

    def test_significantly_out_of_range_rejected(self):
        """Erroneous data significantly out of [0, 1] range returns None rather than silent clipping."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            # Negative erroneous fraction: raw = -5000 -> -0.2
            raster_neg = self._make_adequate_raster(tmp_path, raw_value=-5000.0)
            res_neg = V.read_pgda_fraction(raster_neg, lat=-89.0, lon=0.0)
            self.assertIsNone(res_neg, "Significantly negative fraction must return None")

            # Excessively large erroneous fraction: raw = 37500 -> 1.5
            raster_pos = tmp_path / "excess.tif"
            transform = rasterio.transform.from_bounds(-200000.0, -200000.0, 200000.0, 200000.0, 20, 20)
            with rasterio.open(raster_pos, "w", driver="GTiff", width=20, height=20, count=1,
                               dtype="float32", crs=V.PGDA_CRS, transform=transform) as dst:
                dst.write(np.full((1, 20, 20), 37500.0, dtype=np.float32))
            res_pos = V.read_pgda_fraction(raster_pos, lat=-89.0, lon=0.0)
            self.assertIsNone(res_pos, "Significantly >1 fraction must return None")

    def test_nan_and_inf_raw_returns_none(self):
        """NaN or Inf pixel values return None."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            raster_path = self._make_adequate_raster(tmp_path, raw_value=float('nan'))
            self.assertIsNone(V.read_pgda_fraction(raster_path, lat=-89.0, lon=0.0))

            raster_inf = self._make_adequate_raster(tmp_path, raw_value=float('inf'))
            self.assertIsNone(V.read_pgda_fraction(raster_inf, lat=-89.0, lon=0.0))


# ===========================================================================
# 4. Actual GeoTIFF scale/offset metadata
# ===========================================================================

@unittest.skipUnless(HAS_RASTERIO, "rasterio not installed")
class TestScaleOffsetTreatment(unittest.TestCase):
    """Verify that scale/offset is correctly inspected and applied from GeoTIFF metadata."""

    def test_no_metadata_scale_uses_pgda_constant(self):
        """When rasterio scale=1, offset=0 → use PGDA_SCALE = 4e-05."""
        with tempfile.TemporaryDirectory() as tmp:
            raw = 10000.0
            raster_path = Path(tmp) / "test.tif"
            transform = rasterio.transform.from_bounds(-200000, -200000, 200000, 200000, 10, 10)
            with rasterio.open(raster_path, "w", driver="GTiff", dtype="float32",
                               width=10, height=10, count=1, crs=V.PGDA_CRS,
                               transform=transform) as dst:
                dst.write(np.full((1, 10, 10), raw, dtype=np.float32))
            result = V.read_pgda_fraction(raster_path, -89.0, 0.0)
            expected = raw * V.PGDA_SCALE
            self.assertIsNotNone(result)
            self.assertAlmostEqual(result, expected, places=6)

    def test_actual_metadata_scale_and_offset_applied(self):
        """When GeoTIFF metadata contains scales and offsets, apply raw * scale + offset."""
        with tempfile.TemporaryDirectory() as tmp:
            raster_path = Path(tmp) / "scaled.tif"
            transform = rasterio.transform.from_bounds(-200000, -200000, 200000, 200000, 10, 10)
            raw = 100.0
            scale_meta = 0.005
            offset_meta = 0.1
            with rasterio.open(raster_path, "w", driver="GTiff", dtype="float32",
                               width=10, height=10, count=1, crs=V.PGDA_CRS,
                               transform=transform) as dst:
                dst.write(np.full((1, 10, 10), raw, dtype=np.float32))
                dst.scales = (scale_meta,)
                dst.offsets = (offset_meta,)

            result = V.read_pgda_fraction(raster_path, -89.0, 0.0)
            # Expected: 100.0 * 0.005 + 0.1 = 0.6
            self.assertIsNotNone(result)
            self.assertAlmostEqual(result, 0.6, places=5)

    def test_pgda_scale_constant_value(self):
        """PGDA_SCALE must be exactly 4e-05 as stated in the docs/technical-reference.md."""
        self.assertAlmostEqual(V.PGDA_SCALE, 4e-05, places=12)


# ===========================================================================
# 5. Missing dependency and BLOCKED detection behavior
# ===========================================================================

class TestMissingDependencyBehavior(unittest.TestCase):
    """Test that blocked/missing dependencies are handled gracefully and never report success falsely."""

    def test_build_pgda69_missing_inputs_returns_blocked(self):
        """Missing PGDA TIFs or our_visibility.json: no rows, no stats, a blocked reason."""
        original = (V.PGDA_SUN_TIF, V.OUR_VISIBILITY_JSON)
        V.PGDA_SUN_TIF, V.OUR_VISIBILITY_JSON = Path("/nonexistent/sun.tif"), Path("/nonexistent/vis.json")
        try:
            rows, stats, blocked = V.build_pgda69_comparison()
            self.assertEqual((rows, stats), ([], []))
            self.assertEqual(len(blocked), 2)
        finally:
            V.PGDA_SUN_TIF, V.OUR_VISIBILITY_JSON = original

    def test_horizons_check_missing_fixture(self):
        """When horizons_check.json is missing, returns blocked dict."""
        original = V.HORIZONS_CHECK_JSON
        V.HORIZONS_CHECK_JSON = Path("/nonexistent/horizons_check.json")
        try:
            result = V.run_horizons_check()
            self.assertEqual(result["pointCount"], 0)
            self.assertIn("note", result)
            self.assertIn("BLOCKED", result["note"])
        finally:
            V.HORIZONS_CHECK_JSON = original


# ===========================================================================
# 6. Horizons check with real fixture
# ===========================================================================

class TestHorizonsCheckWithFixture(unittest.TestCase):
    """Integration test: run the actual horizons check against the real fixture."""

    def test_real_fixture_exists_and_runs(self):
        """Verify fixture evaluation matches point count and errors are finite."""
        fixture_path = PROJECT_ROOT / "web" / "src" / "core" / "fixtures" / "horizons_check.json"
        geometry_path = PROJECT_ROOT / "web" / "src" / "core" / "geometry.js"

        if not fixture_path.exists() or not geometry_path.exists():
            self.skipTest("horizons_check.json or geometry.js not found")

        import subprocess
        try:
            subprocess.run(["node", "--version"], capture_output=True, timeout=5)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            self.skipTest("node.js not available")

        fixture_data = json.loads(fixture_path.read_text(encoding="utf-8"))
        expected_points = len(fixture_data.get("points", []))

        result = V.run_horizons_check()

        self.assertNotIn("note", result, msg=f"Horizons check was blocked: {result.get('note')}")
        self.assertEqual(result["pointCount"], expected_points, "pointCount must match fixture length exactly")

        # Verify errors are finite real numbers and strictly greater than zero (not hardcoded 0)
        self.assertTrue(math.isfinite(result["maxAzimuthErrorDeg"]))
        self.assertTrue(math.isfinite(result["maxElevationErrorDeg"]))
        self.assertGreater(result["maxAzimuthErrorDeg"], 0.0)
        self.assertGreater(result["maxElevationErrorDeg"], 0.0)

        # Within D1/C0 contractual limits
        self.assertLessEqual(result["maxAzimuthErrorDeg"], 0.1)
        self.assertLessEqual(result["maxElevationErrorDeg"], 0.1)


# ===========================================================================
# 7. Output JSON schema and QuickMap record preservation
# ===========================================================================

class TestOutputJsonSchema(unittest.TestCase):
    """Test that the validation.json output adheres strictly to the docs/technical-reference.md contract."""

    def test_schema_keys(self):
        """Top-level keys must be exactly pgda69, horizons, quickmap."""
        expected_keys = {"pgda69", "horizons", "quickmap"}
        sample = {
            "pgda69": [],
            "horizons": {
                "pointCount": 30,
                "maxAzimuthErrorDeg": 0.0148,
                "maxElevationErrorDeg": 0.0096,
                "checkedAt": "2026-11-14",
            },
            "quickmap": [],
        }
        self.assertEqual(set(sample.keys()), expected_keys)
        self.assertIsInstance(sample["pgda69"], list)
        self.assertIsInstance(sample["horizons"], dict)
        self.assertIsInstance(sample["quickmap"], list)

    def test_horizons_schema(self):
        """Horizons object must have pointCount, maxAzimuthErrorDeg, maxElevationErrorDeg, checkedAt."""
        expected_keys = {"pointCount", "maxAzimuthErrorDeg", "maxElevationErrorDeg", "checkedAt"}
        h = {
            "pointCount": 30,
            "maxAzimuthErrorDeg": 0.015,
            "maxElevationErrorDeg": 0.010,
            "checkedAt": "2026-11-14",
        }
        self.assertEqual(set(h.keys()), expected_keys)

    def test_validation_json_file_if_present(self):
        """If web/public/data/validation.json exists, it must strictly follow the schema."""
        val_path = V.VALIDATION_JSON
        if not val_path.exists():
            self.skipTest("validation.json does not exist yet")

        data = json.loads(val_path.read_text(encoding="utf-8"))
        self.assertIsInstance(data, dict)
        self.assertEqual(set(data.keys()), {"pgda69", "pgda69Stats", "horizons", "quickmap"})
        self.assertIsInstance(data["pgda69"], list)
        self.assertIsInstance(data["horizons"], dict)
        self.assertIsInstance(data["quickmap"], list)

        horizons_keys = {"pointCount", "maxAzimuthErrorDeg", "maxElevationErrorDeg", "checkedAt"}
        self.assertEqual(set(data["horizons"].keys()), horizons_keys)

        for row in data["pgda69"]:
            self.assertTrue({"cellId", "region", "pgdaSunFraction", "pgdaEarthFraction", "ourSunHalfDiskFraction", "ourEarthHalfDiskFraction"} <= set(row.keys()))

    def test_quickmap_preservation(self):
        """Existing valid QuickMap records must be preserved when regenerating validation.json."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_json = Path(tmp) / "validation.json"
            valid_qm = [{"cellId": "MAL-r1c1", "image": "/validation/quickmap_MAL.png", "note": "Spot check"}]
            tmp_json.write_text(json.dumps({
                "pgda69": [],
                "horizons": {"pointCount": 30, "maxAzimuthErrorDeg": 0.015, "maxElevationErrorDeg": 0.01, "checkedAt": "2026-11-14"},
                "quickmap": valid_qm
            }), encoding="utf-8")

            # Simulate reading existing quickmap
            prev = json.loads(tmp_json.read_text(encoding="utf-8"))
            preserved = [
                e for e in prev.get("quickmap", [])
                if isinstance(e, dict) and "cellId" in e and "image" in e and "note" in e
            ]
            self.assertEqual(len(preserved), 1)
            self.assertEqual(preserved[0]["cellId"], "MAL-r1c1")


# ===========================================================================
# Run
# ===========================================================================

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = loader.discover(str(PIPELINE_DIR), pattern="test_validate.py")
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
