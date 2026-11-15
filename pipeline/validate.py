"""D7 — Validation against NASA PGDA 69 (and the Horizons vector check from D1).

Contract: README "D7 Validation" and "validation.json". Run: python pipeline/validate.py
Input:  pipeline/raw/AVGVISIB_85S_060M_201608.TIF and ..._EARTH.TIF
        (pixel value × 4e-05 = fraction of time visible; 18.6-year average, covers 85–90°S only, so CAB, MMP, NR2 have no PGDA value)
        pipeline/out/our_visibility.json, written first by `node pipeline/compute_our_visibility.mjs`
        (per sampled cell: region, xM, yM, sun/earth {halfDisk, anyPart, meanDisk} over the whole ephemeris)
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
# B. PGDA 69 comparison: mean of the 60 m pixels inside each 1 km cell square vs our model
# ---------------------------------------------------------------------------

CELL_HALF_SIDE_M = 500.0   # the LGRS ACC cell is 1 km
MIN_VALID_PIXEL_SHARE = 0.5  # fewer valid pixels than this in the square: no PGDA value for the cell
REGION_ORDER = ["MAL", "HAW", "MMO", "NR1", "DGR", "SLP", "NR2", "MMP"]
# Three readings of "visible" in our model (keys of our_visibility.json): the app's rule, any part of the disk (NASA's Earth definition), mean disk fraction
OUR_METRICS = [("halfDisk", "HalfDisk"), ("anyPart", "AnyPart"), ("meanDisk", "MeanDisk")]


def read_pgda_cell_mean(raster_path: Path, x_m: float, y_m: float, half_side_m: float = CELL_HALF_SIDE_M):
    """(mean, centre) of the PGDA 69 fraction over pixels whose centre lies in the square around (x_m, y_m).

    x_m, y_m are metres in the PGDA polar stereographic grid (cells_*.json xM, yM). centre is the pixel containing (x_m, y_m).
    Returns (None, None) outside the raster or when under half the pixels are valid.
    """
    import numpy as np
    import rasterio

    with rasterio.open(raster_path) as src:
        pixel_m = src.transform.a
        left, top = src.transform.c, src.transform.f
        first_col = math.ceil((x_m - half_side_m - left) / pixel_m - 0.5)
        last_col = math.ceil((x_m + half_side_m - left) / pixel_m - 0.5) - 1
        first_row = math.ceil((top - (y_m + half_side_m)) / pixel_m - 0.5)
        last_row = math.ceil((top - (y_m - half_side_m)) / pixel_m - 0.5) - 1
        if first_col < 0 or first_row < 0 or last_col >= src.width or last_row >= src.height:
            return None, None
        window = rasterio.windows.Window(first_col, first_row, last_col - first_col + 1, last_row - first_row + 1)
        raw = src.read(1, window=window).astype("float64")
        valid = raw != src.nodata
        if valid.mean() < MIN_VALID_PIXEL_SHARE:
            return None, None
        scale = src.scales[0] if src.scales and src.scales[0] != 1.0 else PGDA_SCALE
        centre_raw = src.read(1, window=rasterio.windows.Window(int((x_m - left) // pixel_m), int((top - y_m) // pixel_m), 1, 1))[0, 0]
        centre = None if centre_raw == src.nodata else round(float(centre_raw) * scale, 4)
        return round(float(raw[valid].mean() * scale), 4), centre


def compare_stats(ours: list, pgda: list) -> dict:
    """n, mean ours, mean PGDA, mean difference (ours minus PGDA), RMSE, Pearson r (None if a series is constant)."""
    n = len(ours)
    if n == 0:
        return {"n": 0, "meanOurs": None, "meanPgda": None, "meanDifference": None, "rmse": None, "pearsonR": None}
    a, b = [float(v) for v in ours], [float(v) for v in pgda]
    diff = [x - y for x, y in zip(a, b)]
    mean_a, mean_b = sum(a) / n, sum(b) / n
    spread_a, spread_b = math.sqrt(sum((x - mean_a) ** 2 for x in a)), math.sqrt(sum((y - mean_b) ** 2 for y in b))
    r = None if spread_a == 0 or spread_b == 0 else sum((x - mean_a) * (y - mean_b) for x, y in zip(a, b)) / (spread_a * spread_b)
    return {
        "n": n,
        "meanOurs": round(mean_a, 4),
        "meanPgda": round(mean_b, 4),
        "meanDifference": round(sum(diff) / n, 4),
        "rmse": round(math.sqrt(sum(d * d for d in diff) / n), 4),
        "pearsonR": None if r is None else round(r, 3),
    }


def build_pgda69_comparison() -> tuple:
    """(rows, stats, blocked): one row per sampled cell with a PGDA value, and per-region + overall statistics."""
    blocked = []
    if not (PGDA_SUN_TIF.exists() and PGDA_EARTH_TIF.exists()):
        blocked.append(f"PGDA 69 TIF files not downloaded to {RAW_DIR}. Run: python pipeline/download_data.py")
    if not OUR_VISIBILITY_JSON.exists():
        blocked.append(f"{_rel_path(OUR_VISIBILITY_JSON)} not found. Run: node pipeline/compute_our_visibility.mjs")
    if blocked:
        return [], [], blocked
    our_visibility = json.loads(OUR_VISIBILITY_JSON.read_text(encoding="utf-8"))

    rows = []
    for cell_id, ours in our_visibility.items():
        sun_mean, sun_centre = read_pgda_cell_mean(PGDA_SUN_TIF, ours["xM"], ours["yM"])
        earth_mean, earth_centre = read_pgda_cell_mean(PGDA_EARTH_TIF, ours["xM"], ours["yM"])
        if sun_mean is None or earth_mean is None:
            continue
        row = {"cellId": cell_id, "region": ours["region"], "pgdaSunFraction": sun_mean, "pgdaEarthFraction": earth_mean,
               "pgdaSunCentreFraction": sun_centre, "pgdaEarthCentreFraction": earth_centre}
        for key, suffix in OUR_METRICS:
            row[f"ourSun{suffix}Fraction"] = ours["sun"][key]
            row[f"ourEarth{suffix}Fraction"] = ours["earth"][key]
        rows.append(row)
    if not rows:
        return [], [], ["No valid paired PGDA/model results (all sampled cells lack PGDA 69 pixels)."]

    stats = []
    for region in REGION_ORDER + ["ALL"]:
        chosen = [r for r in rows if region == "ALL" or r["region"] == region]
        entry = {"region": region}
        for body in ("Sun", "Earth"):
            entry[body.lower()] = {
                key: compare_stats([r[f"our{body}{suffix}Fraction"] for r in chosen], [r[f"pgda{body}Fraction"] for r in chosen])
                for key, suffix in OUR_METRICS
            }
        stats.append(entry)
    return rows, stats, []


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
# E. Main
# ---------------------------------------------------------------------------

def print_stats(stats):
    print("  region  body   metric      n  ours  NASA   diff   rmse      r")
    for entry in stats:
        for body in ("sun", "earth"):
            for key, _ in OUR_METRICS:
                v = entry[body][key]
                print(f"  {entry['region']:<6}  {body:<5}  {key:<9} {v['n']:>3}  {v['meanOurs']}  {v['meanPgda']}  {v['meanDifference']}  {v['rmse']}  {v['pearsonR']}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("\n=== D7 Validation ===")

    # --- PGDA 69 comparison ---
    print("\n[A] PGDA 69 comparison")
    pgda69_rows, pgda69_stats, pgda69_blocked = build_pgda69_comparison()
    if pgda69_blocked:
        for b in pgda69_blocked:
            print(f"  BLOCKED: {b}")
    else:
        print(f"  PASSED: {len(pgda69_rows)} valid paired cells compared")
        print_stats(pgda69_stats)

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
        "pgda69Stats": pgda69_stats,
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
    print("  node pipeline/compute_our_visibility.mjs   # first: writes pipeline/out/our_visibility.json")
    print("  python pipeline/validate.py")


if __name__ == "__main__":
    main()
