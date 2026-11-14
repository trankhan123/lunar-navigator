"""D7 — Validation against NASA PGDA 69 (and the Horizons vector check from D1).

Contract: README "D7 Validation" and "validation.json". Run: python pipeline/validate.py
Input:  web/public/data/cells_<CODE>.json, pipeline/raw/AVGVISIB_85S_060M_201608.TIF and ..._EARTH.TIF
        (pixel value × 4e-05 = fraction of time visible; 18.6-year average, covers 85–90°S only, so CAB, MMP, NR2 have no PGDA value)
        pipeline/out/our_visibility.json = {"<cellId>": {"sunFraction", "earthFraction"}} from the browser core over the whole
        ephemeris (D7 writes a small node script that imports web/src/core/sunlight.js and communication.js)
Output: web/public/data/validation.json
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Paths (import from common where possible, but keep validate.py self-contained)
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE_DIR = PROJECT_ROOT / "pipeline"
RAW_DIR = PIPELINE_DIR / "raw"
OUT_DIR = PIPELINE_DIR / "out"
WEB_DATA_DIR = PROJECT_ROOT / "web" / "public" / "data"
FIXTURES_DIR = PROJECT_ROOT / "web" / "src" / "core" / "fixtures"

PGDA_SUN_TIF = RAW_DIR / "AVGVISIB_85S_060M_201608.TIF"
PGDA_EARTH_TIF = RAW_DIR / "AVGVISIB_85S_060M_201608_EARTH.TIF"
HORIZONS_CHECK_JSON = FIXTURES_DIR / "horizons_check.json"
OUR_VISIBILITY_JSON = OUT_DIR / "our_visibility.json"
VALIDATION_JSON = WEB_DATA_DIR / "validation.json"
VISIBILITY_STATS_MJS = PIPELINE_DIR / "visibility_stats.mjs"

# PGDA 69 scale: raw integer × PGDA_SCALE = fraction (0–1) of time visible.
# Stated in distribution.md: pixel × 4e-05 = fraction.
PGDA_SCALE = 4e-05

# PGDA 69 covers 85–90°S only. Cells north of this lat have no PGDA value.
PGDA_COVERAGE_LAT_LIMIT = -85.0  # any cell with lat > this is outside 85–90°S band

# CRS strings
MOON_LONLAT_CRS = "+proj=longlat +R=1737400 +no_defs"
PGDA_CRS = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"


# Path display helper
def _rel_path(p: Path) -> str:
    """Return path relative to PROJECT_ROOT, or full path if on another drive/subpath."""
    try:
        return str(p.relative_to(PROJECT_ROOT))
    except (ValueError, Exception):
        return str(p)


# ---------------------------------------------------------------------------
# A. Read a pixel from a PGDA 69 raster at a given (lat, lon)
# ---------------------------------------------------------------------------

def read_pgda_fraction(raster_path: Path, lat: float, lon: float) -> Optional[float]:
    """Sample the PGDA 69 raster at (lat, lon) and return the visibility fraction 0–1.

    Returns None if:
    - The raster file does not exist.
    - The point is north of PGDA_COVERAGE_LAT_LIMIT (outside 85–90°S coverage).
    - The point is outside the raster extent.
    - The pixel value is nodata, NaN, infinite, or corrupted.
    - The scaled fraction is significantly out of [0, 1] range (invalid data/scaling).

    Scale application rule (applied exactly once):
    - If rasterio reports non-trivial scale/offset in the GeoTIFF metadata,
      apply: fraction = raw * scale + offset.
    - Otherwise (scale≈1, offset≈0), apply the known PGDA constant:
      fraction = raw * 4e-05.
    - Preserves legitimate small floating-point rounding tolerances (1e-4),
      while rejecting significantly out-of-range values.
    """
    if lat > PGDA_COVERAGE_LAT_LIMIT:
        return None  # outside 85–90°S band

    try:
        import rasterio
        import rasterio.windows
        from pyproj import Transformer
    except ImportError as e:
        raise ImportError(f"rasterio and pyproj are required: {e}")

    if not raster_path.exists():
        return None

    with rasterio.open(raster_path) as src:
        # Determine the raster CRS (should be PGDA south polar stereographic)
        raster_crs = src.crs.to_proj4() if src.crs else PGDA_CRS

        # Transform (lon, lat) → raster coordinates
        transformer = Transformer.from_crs(MOON_LONLAT_CRS, raster_crs, always_xy=True)
        x, y = transformer.transform(lon, lat)

        # Convert to pixel row/col
        try:
            row, col = src.index(x, y)
        except Exception:
            return None  # point outside transform domain

        if not (0 <= row < src.height and 0 <= col < src.width):
            return None  # outside raster extent

        # Read single pixel
        window = rasterio.windows.Window(col, row, 1, 1)
        data = src.read(1, window=window)
        if data.size == 0:
            return None

        raw = float(data[0, 0])

        if math.isnan(raw) or math.isinf(raw):
            return None

        # Check nodata
        nodata = src.nodata
        if nodata is not None:
            if math.isnan(nodata):
                return None
            elif abs(raw - nodata) < 1e-6:
                return None

        # Inspect GeoTIFF scale/offset metadata (rasterio .scales/.offsets)
        scales = src.scales if src.scales else (1.0,)
        offsets = src.offsets if src.offsets else (0.0,)
        scale_meta = float(scales[0]) if (scales and scales[0] is not None) else 1.0
        offset_meta = float(offsets[0]) if (offsets and offsets[0] is not None) else 0.0

        if math.isnan(scale_meta) or math.isinf(scale_meta) or scale_meta <= 0:
            return None
        if math.isnan(offset_meta) or math.isinf(offset_meta):
            return None

        # Apply scale exactly once
        if abs(scale_meta - 1.0) < 1e-9 and abs(offset_meta) < 1e-9:
            # No metadata scale — use the known PGDA 69 constant
            fraction = raw * PGDA_SCALE
        else:
            fraction = raw * scale_meta + offset_meta

        if math.isnan(fraction) or math.isinf(fraction):
            return None

        # Preserve legitimate small floating-point rounding tolerances (1e-4)
        TOLERANCE = 1e-4
        if fraction < -TOLERANCE or fraction > 1.0 + TOLERANCE:
            return None  # Significantly out of range: invalid or corrupt data

        return max(0.0, min(1.0, fraction))


# ---------------------------------------------------------------------------
# B. PGDA 69 comparison — build pgda69 array
# ---------------------------------------------------------------------------

def build_pgda69_comparison(cells_files: list) -> tuple:
    """Compare our model's sun/earth fractions against PGDA 69 for all cells.

    Returns (pgda69_rows, blocked_reasons).
    Never reports success when there are no valid paired PGDA/model results.
    """
    blocked = []
    rasters_available = PGDA_SUN_TIF.exists() and PGDA_EARTH_TIF.exists()
    if not rasters_available:
        blocked.append(
            f"PGDA 69 TIF files not downloaded to {RAW_DIR}. "
            "Run: python pipeline/download_data.py"
        )

    our_vis = {}
    if not OUR_VISIBILITY_JSON.exists():
        blocked.append(
            f"{_rel_path(OUR_VISIBILITY_JSON)} not found. "
            "Run: node pipeline/visibility_stats.mjs (requires C1+C2+D5)."
        )
    else:
        try:
            our_vis = json.loads(OUR_VISIBILITY_JSON.read_text(encoding="utf-8"))
            if not our_vis:
                blocked.append(
                    f"{_rel_path(OUR_VISIBILITY_JSON)} is empty. "
                    "Run: node pipeline/visibility_stats.mjs (requires C1+C2+D5)."
                )
        except Exception as e:
            blocked.append(f"Failed to read {_rel_path(OUR_VISIBILITY_JSON)}: {e}")

    if not cells_files:
        blocked.append("No real cells_*.json files found in web/public/data/ (requires D5).")
        return [], blocked

    rows = []
    paired_valid_count = 0

    for cells_file in cells_files:
        cells_file = Path(cells_file)
        if not cells_file.exists():
            continue
        try:
            cells_data = json.loads(cells_file.read_text(encoding="utf-8"))
        except Exception:
            continue
        cells = cells_data.get("cells", [])

        for cell in cells:
            cell_id = cell.get("id")
            lat = cell.get("lat")
            lon = cell.get("lon")
            if not cell_id or lat is None or lon is None:
                continue

            # Only compare cells within 85–90°S PGDA coverage
            if lat > PGDA_COVERAGE_LAT_LIMIT:
                continue

            pgda_sun = read_pgda_fraction(PGDA_SUN_TIF, lat, lon) if rasters_available else None
            pgda_earth = read_pgda_fraction(PGDA_EARTH_TIF, lat, lon) if rasters_available else None

            our_sun = None
            our_earth = None
            if cell_id in our_vis:
                v = our_vis[cell_id]
                if isinstance(v, dict):
                    our_sun = v.get("sunFraction")
                    our_earth = v.get("earthFraction")

            def _r(val):
                return round(float(val), 4) if val is not None and math.isfinite(val) else None

            r_pgda_sun = _r(pgda_sun)
            r_pgda_earth = _r(pgda_earth)
            r_our_sun = _r(our_sun)
            r_our_earth = _r(our_earth)

            # Check for a valid paired comparison
            if r_pgda_sun is not None and r_our_sun is not None:
                paired_valid_count += 1

            rows.append({
                "cellId": cell_id,
                "pgdaSunFraction": r_pgda_sun,
                "pgdaEarthFraction": r_pgda_earth,
                "ourSunFraction": r_our_sun,
                "ourEarthFraction": r_our_earth,
            })

    # If there are no valid paired comparisons at all, the comparison is BLOCKED!
    if paired_valid_count == 0:
        blocked.append(
            "No valid paired PGDA/model results (missing rasters, missing model outputs, or all-null comparisons)."
        )
        return [], blocked

    return rows, blocked


# ---------------------------------------------------------------------------
# C. Horizons check — compare geometry.js bodyAzimuthElevation against fixture
# ---------------------------------------------------------------------------

def _angular_diff_360(a: float, b: float) -> float:
    """Minimum absolute angular difference between two azimuths (handles 0/360 wrap)."""
    diff = abs(a - b) % 360.0
    return min(diff, 360.0 - diff)


def run_horizons_check() -> dict:
    """Compare geometry.js bodyAzimuthElevation against horizons_check.json.

    Uses a temporary Node.js script to call the real geometry.js implementation.
    Returns:
      {pointCount, maxAzimuthErrorDeg, maxElevationErrorDeg, checkedAt}
    or a dict with an extra 'note' key when blocked.
    """
    if not HORIZONS_CHECK_JSON.exists():
        return {
            "pointCount": 0,
            "maxAzimuthErrorDeg": None,
            "maxElevationErrorDeg": None,
            "checkedAt": None,
            "note": "BLOCKED: fixtures/horizons_check.json not found (requires D1)",
        }

    fixture = json.loads(HORIZONS_CHECK_JSON.read_text(encoding="utf-8"))
    points = fixture.get("points", [])

    if not points:
        return {
            "pointCount": 0,
            "maxAzimuthErrorDeg": None,
            "maxElevationErrorDeg": None,
            "checkedAt": None,
            "note": "BLOCKED: horizons_check.json has no points",
        }

    geometry_js = PROJECT_ROOT / "web" / "src" / "core" / "geometry.js"
    if not geometry_js.exists():
        return {
            "pointCount": 0,
            "maxAzimuthErrorDeg": None,
            "maxElevationErrorDeg": None,
            "checkedAt": None,
            "note": "BLOCKED: web/src/core/geometry.js not found",
        }

    # Build a temporary ESM Node.js script that imports geometry.js and
    # evaluates all fixture points, outputting JSON results.
    js_points = json.dumps(points)
    # Use file:// URL for the import path (Windows-compatible)
    geometry_url = geometry_js.as_posix()

    js_script = f"""import {{ bodyAzimuthElevation }} from 'file:///{geometry_url}';
const points = {js_points};
const results = points.map(p => {{
  const cell = {{ lat: p.lat, lon: p.lon, heightM: p.heightM }};
  const r = bodyAzimuthElevation(cell, p.subLonDeg, p.subLatDeg, p.distanceKm);
  return {{ az: r.azimuthDeg, el: r.elevationDeg, refAz: p.azimuthDeg, refEl: p.elevationDeg }};
}});
console.log(JSON.stringify(results));
"""

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp_script = OUT_DIR / "_horizons_check_runner.mjs"
    tmp_script.write_text(js_script, encoding="utf-8")

    try:
        result = subprocess.run(
            ["node", str(tmp_script)],
            capture_output=True, text=True, timeout=30, cwd=str(PROJECT_ROOT)
        )
    except Exception as e:
        tmp_script.unlink(missing_ok=True)
        return {
            "pointCount": 0,
            "maxAzimuthErrorDeg": None,
            "maxElevationErrorDeg": None,
            "checkedAt": None,
            "note": f"BLOCKED: node execution failed — {e}",
        }
    finally:
        try:
            tmp_script.unlink(missing_ok=True)
        except Exception:
            pass

    if result.returncode != 0:
        return {
            "pointCount": 0,
            "maxAzimuthErrorDeg": None,
            "maxElevationErrorDeg": None,
            "checkedAt": None,
            "note": f"BLOCKED: node error — {result.stderr[:400]}",
        }

    try:
        calc_points = json.loads(result.stdout.strip())
    except json.JSONDecodeError:
        return {
            "pointCount": 0,
            "maxAzimuthErrorDeg": None,
            "maxElevationErrorDeg": None,
            "checkedAt": None,
            "note": f"BLOCKED: could not parse node output — {result.stdout[:200]}",
        }

    if len(calc_points) != len(points):
        return {
            "pointCount": 0,
            "maxAzimuthErrorDeg": None,
            "maxElevationErrorDeg": None,
            "checkedAt": None,
            "note": f"BLOCKED: expected {len(points)} points from Horizons check, got {len(calc_points)}",
        }

    max_az_err = 0.0
    max_el_err = 0.0
    for cp in calc_points:
        if not ("az" in cp and "el" in cp and "refAz" in cp and "refEl" in cp):
            return {
                "pointCount": 0,
                "maxAzimuthErrorDeg": None,
                "maxElevationErrorDeg": None,
                "checkedAt": None,
                "note": "FAILED: malformed output from geometry runner",
            }
        az_err = _angular_diff_360(cp["az"], cp["refAz"])
        el_err = abs(cp["el"] - cp["refEl"])
        if not (math.isfinite(az_err) and math.isfinite(el_err)):
            return {
                "pointCount": len(calc_points),
                "maxAzimuthErrorDeg": None,
                "maxElevationErrorDeg": None,
                "checkedAt": None,
                "note": "FAILED: non-finite error computed during Horizons check",
            }
        if az_err > max_az_err:
            max_az_err = az_err
        if el_err > max_el_err:
            max_el_err = el_err

    if not (math.isfinite(max_az_err) and math.isfinite(max_el_err)):
        return {
            "pointCount": len(calc_points),
            "maxAzimuthErrorDeg": None,
            "maxElevationErrorDeg": None,
            "checkedAt": None,
            "note": "FAILED: computed max error is not finite",
        }

    return {
        "pointCount": len(calc_points),
        "maxAzimuthErrorDeg": round(max_az_err, 4),
        "maxElevationErrorDeg": round(max_el_err, 4),
        "checkedAt": date.today().isoformat(),
    }


# ---------------------------------------------------------------------------
# D. Maintained helper check
# ---------------------------------------------------------------------------

def check_visibility_stats_script() -> bool:
    """Verify that pipeline/visibility_stats.mjs exists as a maintained source file."""
    if not VISIBILITY_STATS_MJS.exists():
        print(f"  WARNING: {_rel_path(VISIBILITY_STATS_MJS)} not found.")
        return False
    return True


# ---------------------------------------------------------------------------
# E. Main
# ---------------------------------------------------------------------------

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Check that visibility_stats.mjs is present as the maintained source file
    check_visibility_stats_script()

    # Collect real cells files (not in mock subdirectory)
    cells_files = sorted(WEB_DATA_DIR.glob("cells_*.json"))
    cells_files = [f for f in cells_files if "mock" not in str(f)]

    print("\n=== D7 Validation ===")

    # --- PGDA 69 comparison ---
    print("\n[A] PGDA 69 comparison")
    if not cells_files:
        print("  BLOCKED: No real cells_*.json in web/public/data/ — run D5 first.")
        pgda69_rows = []
        pgda69_blocked = ["D5 (cells data) not available - run pipeline/build_site_data.py first"]
    else:
        pgda69_rows, pgda69_blocked = build_pgda69_comparison(cells_files)
        if pgda69_blocked:
            for b in pgda69_blocked:
                print(f"  BLOCKED: {b}")
        else:
            print(f"  PASSED: {len(pgda69_rows)} valid paired cells compared")

    # --- Horizons check ---
    print("\n[C] Horizons geometry check (C0 / geometry.js vs JPL fixture)")
    horizons = run_horizons_check()
    horizons_note = horizons.pop("note", None)
    if horizons_note:
        print(f"  BLOCKED: {horizons_note}")
    else:
        print(f"  PASSED: {horizons['pointCount']} points, "
              f"max az error = {horizons['maxAzimuthErrorDeg']}°, "
              f"max el error = {horizons['maxElevationErrorDeg']}°")

    # --- Preserve existing QuickMap records if present ---
    existing_quickmap = []
    if VALIDATION_JSON.exists():
        try:
            prev = json.loads(VALIDATION_JSON.read_text(encoding="utf-8"))
            if isinstance(prev.get("quickmap"), list):
                for entry in prev["quickmap"]:
                    if isinstance(entry, dict) and "cellId" in entry and "image" in entry and "note" in entry:
                        existing_quickmap.append(entry)
        except Exception:
            pass

    # --- Write validation.json ---
    # Preserve the exact README schema: pgda69, horizons, quickmap
    out = {
        "pgda69": pgda69_rows,
        "horizons": {
            "pointCount": horizons["pointCount"],
            "maxAzimuthErrorDeg": horizons["maxAzimuthErrorDeg"],
            "maxElevationErrorDeg": horizons["maxElevationErrorDeg"],
            "checkedAt": horizons["checkedAt"],
        },
        "quickmap": existing_quickmap,
    }

    WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)
    VALIDATION_JSON.write_text(
        json.dumps(out, separators=(",", ":"), ensure_ascii=False),
        encoding="utf-8",
    )
    mb = VALIDATION_JSON.stat().st_size / 1e6
    print(f"\nwrote  web/public/data/validation.json ({mb:.4f} MB)")

    # --- Summary ---
    print("\n=== SUMMARY ===")
    if pgda69_blocked or len(pgda69_rows) == 0:
        print("  pgda69: BLOCKED")
        for b in pgda69_blocked:
            print(f"    - {b}")
    else:
        print(f"  pgda69: PASSED ({len(pgda69_rows)} valid paired cells)")

    if horizons_note:
        print(f"  horizons: BLOCKED — {horizons_note}")
    else:
        print(f"  horizons: PASSED ({horizons['pointCount']} points, "
              f"az err ≤ {horizons['maxAzimuthErrorDeg']}°, "
              f"el err ≤ {horizons['maxElevationErrorDeg']}°)")

    if existing_quickmap:
        print(f"  quickmap: PASSED ({len(existing_quickmap)} records preserved)")
    else:
        print("  quickmap: PENDING (manual screenshot required from QuickMap)")

    print()
    print("To reproduce:")
    print("  python pipeline/validate.py")
    print("  node pipeline/visibility_stats.mjs   # (after C1+C2+D5 are done)")


if __name__ == "__main__":
    main()
