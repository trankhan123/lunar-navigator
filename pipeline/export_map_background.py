"""D8 — Map backgrounds for the 2D south-pole map: hillshade → PNG.

Contract: README "D8 Map background". Run: python pipeline/export_map_background.py (after build_site_data.py)
Input:  pipeline/raw/LDEM_80S_80MPP_ADJ_HILL.TIF (PGDA 90 hillshade, 80 m, values 0–255), web/public/data/regions.json
Output: web/public/maps/south_pole.png (whole 80°S map), web/public/maps/<CODE>.png (one per region, native 80 m),
        web/public/maps/maps.json = {"maps": [{"id", "kind": "hillshade", "image", "boundsM", "metersPerPixel"}]}
        boundsM = [xMin, yMin, xMax, yMax] of the image edges in common.PGDA_CRS. PNG written by rasterio (GDAL PNG driver).
        Not done yet: the optional PGDA 69 Sun-visibility overlay (kind "sun-visibility").
"""
import json
import warnings

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.errors import NotGeoreferencedWarning
from rasterio.windows import from_bounds

from common import PROJECT_ROOT, RAW_FOLDER, WEB_DATA_FOLDER, write_json

HILLSHADE_FILE = RAW_FOLDER / "LDEM_80S_80MPP_ADJ_HILL.TIF"
MAPS_FOLDER = PROJECT_ROOT / "web" / "public" / "maps"
MAX_IMAGE_BYTES = 1_000_000
REGION_MARGIN_M = 2000
SOUTH_POLE_METERS_PER_PIXEL = [400, 500, 640, 800]  # the coarsest is used only if finer ones pass 1 MB


def write_png(path, values):
    warnings.filterwarnings("ignore", category=NotGeoreferencedWarning)  # placement goes in maps.json, not in the PNG
    with rasterio.open(path, "w", driver="PNG", width=values.shape[1], height=values.shape[0], count=1, dtype="uint8") as png:
        png.write(np.clip(np.nan_to_num(values), 0, 255).astype(np.uint8), 1)
    path.with_name(path.name + ".aux.xml").unlink(missing_ok=True)  # GDAL side file, not needed on the web
    return path.stat().st_size


def map_entry(map_id, bounds, meters_per_pixel):
    return {"id": map_id, "kind": "hillshade", "image": f"/maps/{map_id}.png", "boundsM": [round(value, 1) for value in bounds],
            "metersPerPixel": meters_per_pixel}


def export_south_pole(source):
    for meters_per_pixel in SOUTH_POLE_METERS_PER_PIXEL:
        size = round(source.width * source.res[0] / meters_per_pixel)
        values = source.read(1, out_shape=(size, size), resampling=Resampling.average)
        if write_png(MAPS_FOLDER / "south_pole.png", values) <= MAX_IMAGE_BYTES:
            return map_entry("south_pole", list(source.bounds), source.width * source.res[0] / size)
    raise SystemExit("south_pole.png stays over 1 MB at every scale")


def export_region(source, region):
    x_min, y_min, x_max, y_max = region["boundsM"]
    window = from_bounds(x_min - REGION_MARGIN_M, y_min - REGION_MARGIN_M, x_max + REGION_MARGIN_M, y_max + REGION_MARGIN_M,
                         source.transform).round_offsets().round_lengths()
    left, bottom, right, top = rasterio.windows.bounds(window, source.transform)
    if write_png(MAPS_FOLDER / f"{region['code']}.png", source.read(1, window=window)) > MAX_IMAGE_BYTES:
        raise SystemExit(f"{region['code']}.png is over 1 MB")
    return map_entry(region["code"], [left, bottom, right, top], source.res[0])


if __name__ == "__main__":
    regions = json.loads((WEB_DATA_FOLDER / "regions.json").read_text(encoding="utf-8"))["regions"]
    MAPS_FOLDER.mkdir(parents=True, exist_ok=True)
    with rasterio.open(HILLSHADE_FILE) as source:
        maps = [export_south_pole(source)] + [export_region(source, region) for region in regions]
    for entry in maps:
        print(f"{entry['id']:10s} {entry['metersPerPixel']:.0f} m/px  {(MAPS_FOLDER / (entry['id'] + '.png')).stat().st_size / 1e3:.0f} kB")
    write_json(MAPS_FOLDER / "maps.json", {"maps": maps})
