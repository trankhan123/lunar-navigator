"""D8 — Map images for the 2D south-pole map: hillshade backgrounds and NASA overlays → PNG.

Contract: README "D8 Map background". Run: python pipeline/export_map_background.py (after build_site_data.py)
Input:  pipeline/raw/LDEM_80S_80MPP_ADJ_HILL.TIF (PGDA 90 hillshade, 80 m, values 0–255), web/public/data/regions.json,
        pipeline/raw/AVGVISIB_85S_060M_201608.TIF and …_EARTH.TIF (PGDA 69 Sun / Earth visibility, 60 m, ±151.74 km, × 4e-05),
        pipeline/raw/LPSR_80S_20MPP_ADJ.TIF (PGDA 90 permanent shadow, 20 m, 0/1)
Output: web/public/maps/south_pole.png (whole 80°S map), web/public/maps/<CODE>.png (one per region, native 80 m),
        <CODE>_sun.png, <CODE>_earth.png (RGBA, FRACTION_COLORS for 0 → 1, transparent where no data; only regions that
        overlap the PGDA 69 square), <CODE>_psr.png (RGBA, PSR_COLOR on permanent shadow, transparent elsewhere),
        Whole-pole overlays, id "south_pole" (palette PNGs): south_pole_sun.png / _earth.png (the 85°S PGDA 69 square), south_pole_psr.png,
        south_pole_slope.png (kind "slope": LDSM 80 m classes < 10°, 10–15°, 15–20°, > 20° hatched, the app's infeasible colour),
        web/public/maps/maps.json = {"maps": [{"id", "kind", "image", "boundsM", "metersPerPixel"}]},
        kind = "hillshade" | "sun-visibility" | "earth-visibility" | "psr" | "slope", hillshades listed first.
        Relief tiles for the web map: export_relief_tiles.py.
        boundsM = [xMin, yMin, xMax, yMax] of the image edges in common.PGDA_CRS. PNG written by rasterio (GDAL PNG driver).
"""
import json
import warnings
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.errors import NotGeoreferencedWarning
from rasterio.windows import from_bounds

from PIL import Image

from common import PROJECT_ROOT, RAW_FOLDER, SLOPE_LIMIT_DEG, WEB_DATA_FOLDER, write_json

HILLSHADE_FILE = RAW_FOLDER / "LDEM_80S_80MPP_ADJ_HILL.TIF"
OVERLAYS = [("sun-visibility", "sun", RAW_FOLDER / "AVGVISIB_85S_060M_201608.TIF"),  # (kind, image suffix, raster)
            ("earth-visibility", "earth", RAW_FOLDER / "AVGVISIB_85S_060M_201608_EARTH.TIF"),
            ("psr", "psr", RAW_FOLDER / "LPSR_80S_20MPP_ADJ.TIF")]
MAPS_FOLDER = PROJECT_ROOT / "web" / "public" / "maps"
MAX_IMAGE_BYTES = 1_000_000
REGION_MARGIN_M = 2000
SOUTH_POLE_METERS_PER_PIXEL = [400, 500, 640, 800]  # the coarsest is used only if finer ones pass 1 MB
FRACTION_COLORS = ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"]  # viridis 0 → 1, the web map's FRACTION_RAMP
PSR_COLOR = "#cc79a7"
SLOPE_FILE = RAW_FOLDER / "LDSM_80S_80MPP_ADJ.TIF"
# Palette of slope_class_indices: 0 no data, 1 < 10°, 2 10–15°, 3 15–20°, 4 steeper than SLOPE_LIMIT_DEG (the app's infeasible colour), 5 its hatch.
SLOPE_PALETTE = ["#000000", "#009e73", "#f0e442", "#e69f00", "#334155", "#94a3b8"]
WHOLE_POLE_SCALES = [1, 1.5, 2, 3]  # pixel-size multiples tried in turn until the PNG is ≤ 1 MB


def rgb(color):
    return list(bytes.fromhex(color[1:]))


def fraction_to_rgba(fraction):
    """Fractions 0–1 → (4, h, w) uint8 in the FRACTION_COLORS ramp, opaque; NaN (no data) → transparent."""
    stops = np.linspace(0, 1, len(FRACTION_COLORS))
    channels = np.array([rgb(color) for color in FRACTION_COLORS]).T
    known = np.nan_to_num(fraction)
    return np.array([np.rint(np.interp(known, stops, channel)) for channel in channels]
                    + [np.where(np.isnan(fraction), 0, 255)]).astype(np.uint8)


def psr_to_rgba(psr):
    """Permanent shadow 0/1 (NaN = no data) → (4, h, w) uint8: PSR_COLOR where ≥ 0.5, transparent elsewhere."""
    return np.array([np.full(psr.shape, channel) for channel in rgb(PSR_COLOR)] + [np.where(psr >= 0.5, 255, 0)]).astype(np.uint8)


def fraction_to_palette(fraction):
    """Fractions 0–1 (NaN = no data) → (indices, palette): index 0 transparent, 1 + round(100 × fraction) a FRACTION_COLORS step."""
    palette = [[0, 0, 0, 0]] + [[*color, 255] for color in fraction_to_rgba(np.linspace(0, 1, 101)[np.newaxis])[:3, 0].T.tolist()]
    return np.where(np.isnan(fraction), 0, 1 + np.rint(np.nan_to_num(fraction) * 100)).astype(np.uint8), palette


def slope_class_indices(slope_deg, hatch_period_px=8):
    """Slope degrees (NaN = no data) → palette indices of SLOPE_PALETTE; steep pixels get diagonal stripes (period hatch_period_px, 0 = none)."""
    classes = np.where(np.isnan(slope_deg), 0, 1 + (slope_deg >= 10) + (slope_deg >= 15) + (slope_deg > SLOPE_LIMIT_DEG)).astype(np.uint8)
    if hatch_period_px:
        rows, columns = np.indices(classes.shape)
        classes[(classes == 4) & ((rows + columns) % hatch_period_px < hatch_period_px // 3 + 1)] = 5
    return classes


def write_palette_png(path, indices, palette):
    """Indexed PNG (palette entries are RGBA lists); smaller than RGBA for images with few colours."""
    image = Image.fromarray(indices, mode="P")
    image.putpalette([channel for color in palette for channel in color[:3]])
    image.save(path, transparency=bytes(color[3] if len(color) > 3 else 255 for color in palette), optimize=True)
    return path.stat().st_size


def overlay_bounds(window_bounds, raster_bounds):
    """The part of window_bounds [x0, y0, x1, y1] inside raster_bounds, or None when they do not overlap."""
    x0, y0 = max(window_bounds[0], raster_bounds[0]), max(window_bounds[1], raster_bounds[1])
    x1, y1 = min(window_bounds[2], raster_bounds[2]), min(window_bounds[3], raster_bounds[3])
    return [x0, y0, x1, y1] if x0 < x1 and y0 < y1 else None


def write_png(path, values):
    """values: a 2-D grey image (0–255) or a (4, h, w) uint8 RGBA image."""
    warnings.filterwarnings("ignore", category=NotGeoreferencedWarning)  # placement goes in maps.json, not in the PNG
    bands = values if values.ndim == 3 else np.clip(np.nan_to_num(values), 0, 255).astype(np.uint8)[np.newaxis]
    with rasterio.open(path, "w", driver="PNG", width=bands.shape[2], height=bands.shape[1], count=len(bands), dtype="uint8") as png:
        png.write(bands)
    path.with_name(path.name + ".aux.xml").unlink(missing_ok=True)  # GDAL side file, not needed on the web
    return path.stat().st_size


def map_entry(map_id, bounds, meters_per_pixel, kind="hillshade", image_name=None):
    return {"id": map_id, "kind": kind, "image": f"/maps/{image_name or map_id + '.png'}",
            "boundsM": [round(value, 1) for value in bounds], "metersPerPixel": meters_per_pixel}


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


def export_overlay(source, region, kind, suffix):
    """One NASA overlay PNG for a region at the raster's own resolution; None when the region is outside the raster."""
    x_min, y_min, x_max, y_max = region["boundsM"]
    bounds = overlay_bounds([x_min - REGION_MARGIN_M, y_min - REGION_MARGIN_M, x_max + REGION_MARGIN_M, y_max + REGION_MARGIN_M],
                            tuple(source.bounds))
    if bounds is None:
        return None
    window = from_bounds(*bounds, source.transform).round_offsets().round_lengths()
    values = source.read(1, window=window, masked=True).astype(float).filled(np.nan) * source.scales[0]
    image_name = f"{region['code']}_{suffix}.png"
    if write_png(MAPS_FOLDER / image_name, psr_to_rgba(values) if kind == "psr" else fraction_to_rgba(values)) > MAX_IMAGE_BYTES:
        raise SystemExit(f"{image_name} is over 1 MB")
    return map_entry(region["code"], rasterio.windows.bounds(window, source.transform), source.res[0], kind, image_name)


def export_whole_pole_overlays():
    """Overlays over the whole map, not tied to a region: kinds sun/earth-visibility (PGDA 69 square), psr and slope, all with id south_pole."""
    jobs = [("sun-visibility", "sun", OVERLAYS[0][2]), ("earth-visibility", "earth", OVERLAYS[1][2]), ("psr", "psr", OVERLAYS[2][2]), ("slope", "slope", SLOPE_FILE)]
    entries = []
    for kind, suffix, raster_file in jobs:
        with rasterio.open(raster_file) as source:
            width = source.width if kind != "psr" else round(source.width * source.res[0] / 80)  # PSR 20 m → 80 m
            for scale in WHOLE_POLE_SCALES:
                size = round(width / scale)
                values = source.read(1, out_shape=(size, size), masked=True, resampling=Resampling.average if kind == "psr" else Resampling.nearest)
                values = values.astype(float).filled(np.nan) * source.scales[0]
                if kind == "slope":
                    indices, palette = slope_class_indices(values), [rgb(color) + [0 if index == 0 else 255] for index, color in enumerate(SLOPE_PALETTE)]
                elif kind == "psr":
                    indices, palette = (values >= 0.5).astype(np.uint8), [[0, 0, 0, 0], rgb(PSR_COLOR) + [255]]
                else:
                    indices, palette = fraction_to_palette(values)
                image_name = f"south_pole_{suffix}.png"
                if write_palette_png(MAPS_FOLDER / image_name, indices, palette) <= MAX_IMAGE_BYTES:
                    entries.append(map_entry("south_pole", list(source.bounds), source.width * source.res[0] / size, kind, image_name))
                    break
            else:
                raise SystemExit(f"{image_name} stays over 1 MB at every scale")
    return entries


if __name__ == "__main__":
    regions = json.loads((WEB_DATA_FOLDER / "regions.json").read_text(encoding="utf-8"))["regions"]
    MAPS_FOLDER.mkdir(parents=True, exist_ok=True)
    with rasterio.open(HILLSHADE_FILE) as source:
        maps = [export_south_pole(source)] + [export_region(source, region) for region in regions]
    for kind, suffix, raster_file in OVERLAYS:
        with rasterio.open(raster_file) as source:
            maps += [entry for region in regions if (entry := export_overlay(source, region, kind, suffix))]
    maps += export_whole_pole_overlays()
    for entry in maps:
        size_kb = (MAPS_FOLDER / Path(entry["image"]).name).stat().st_size / 1e3
        print(f"{entry['id']:10s} {entry['kind']:16s} {entry['metersPerPixel']:.0f} m/px  {size_kb:.0f} kB")
    write_json(MAPS_FOLDER / "maps.json", {"maps": maps})
