"""D10 — Terrain height maps for the web 3D view: one Int16 .bin per region.

Contract: README "D10 Terrain meshes". Run: python pipeline/export_terrain_mesh.py [path/to/LDEM_80S_80MPP_ADJ.TIF]
Input:  pipeline/raw/LDEM_80S_80MPP_ADJ.TIF (PGDA 90 DEM, 80 m), web/public/data/regions.json
Output: web/public/terrain/<CODE>.bin (little-endian Int16 metres, row-major, row 0 = north edge, column 0 = west edge,
        height = DEM − d²/(2R) with d the distance from the window centre) and web/public/terrain/index.json.
"""
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

from common import MOON_RADIUS_M, PROJECT_ROOT, RAW_FOLDER, WEB_DATA_FOLDER, write_json

DEM_FILE = RAW_FOLDER / "LDEM_80S_80MPP_ADJ.TIF"
TERRAIN_FOLDER = PROJECT_ROOT / "web" / "public" / "terrain"
MARGIN_M = 8000
MAX_SAMPLES = 320
MAX_FILE_BYTES = 300_000


def window_size(bounds):
    """(width, height) in samples for bounds [x0, y0, x1, y1]: the longer side gets MAX_SAMPLES (never upsampled by the caller)."""
    width_m, height_m = bounds[2] - bounds[0], bounds[3] - bounds[1]
    scale = MAX_SAMPLES / max(width_m, height_m)
    return max(2, round(width_m * scale)), max(2, round(height_m * scale))


def remove_curvature(heights, bounds):
    """Subtract d²/(2R) (d from the window centre) so the flat height map follows the Moon's curved surface."""
    rows, columns = heights.shape
    x = bounds[0] + (np.arange(columns) + 0.5) * (bounds[2] - bounds[0]) / columns - (bounds[0] + bounds[2]) / 2
    y = bounds[3] - (np.arange(rows) + 0.5) * (bounds[3] - bounds[1]) / rows - (bounds[1] + bounds[3]) / 2
    return heights - (x[np.newaxis, :] ** 2 + y[:, np.newaxis] ** 2) / (2 * MOON_RADIUS_M)


def export_region(source, region):
    x_min, y_min, x_max, y_max = region["boundsM"]
    window = from_bounds(x_min - MARGIN_M, y_min - MARGIN_M, x_max + MARGIN_M, y_max + MARGIN_M, source.transform)
    bounds = list(rasterio.windows.bounds(window, source.transform))
    width, height = window_size(bounds)
    values = source.read(1, window=window, out_shape=(height, width), resampling=Resampling.average, masked=True, boundless=True)
    metres = values.astype(float).filled(np.nan) * source.scales[0] + source.offsets[0]
    metres = np.where(np.isnan(metres), np.nanmin(metres), metres)  # no-data (outside the DEM) sits at the lowest point
    flat = np.rint(remove_curvature(metres, bounds)).astype("<i2")
    file_name = f"{region['code']}.bin"
    (TERRAIN_FOLDER / file_name).write_bytes(flat.tobytes())
    if flat.nbytes > MAX_FILE_BYTES:
        raise SystemExit(f"{file_name} is over 300 KB")
    return {"code": region["code"], "boundsM": [round(value, 1) for value in bounds], "width": width, "height": height,
            "file": f"/terrain/{file_name}", "metresPerSample": round((bounds[2] - bounds[0]) / width, 2),
            "minHeightM": int(flat.min()), "maxHeightM": int(flat.max()), "curvatureRemoved": True}


if __name__ == "__main__":
    regions = json.loads((WEB_DATA_FOLDER / "regions.json").read_text(encoding="utf-8"))["regions"]
    TERRAIN_FOLDER.mkdir(parents=True, exist_ok=True)
    with rasterio.open(Path(sys.argv[1]) if len(sys.argv) > 1 else DEM_FILE) as source:
        entries = [export_region(source, region) for region in regions]
    write_json(TERRAIN_FOLDER / "index.json", {"regions": entries})
    for entry in entries:
        print(entry["code"], entry["width"], "x", entry["height"], f"{entry['metresPerSample']} m/sample", entry["minHeightM"], "…", entry["maxHeightM"], "m")
