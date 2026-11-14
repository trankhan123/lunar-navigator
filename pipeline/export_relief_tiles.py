"""D8b — Relief tile pyramid for the 2D south-pole map: shaded relief + elevation tint + contour lines → 512 px JPEG tiles.

Contract: README "D8 Map background" (relief tiles). Run: python pipeline/export_relief_tiles.py (after build_site_data.py)
Input:  pipeline/raw/LDEM_80S_80MPP_ADJ.TIF (PGDA 90 DEM, 80 m, ±304 km square), web/public/data/regions.json
Output: web/public/maps/relief/<z>/<x>_<y>.jpg and web/public/maps/relief/index.json
        Level z has 2^z × 2^z tiles over the whole ±304 km square; tile (x, y): x grows east, y grows south (row 0 = north edge).
        The finest level is written only for tiles that touch the 85°S disk or a region frame; tiles without DEM data are not written.
"""
import json
import shutil

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling

from common import RAW_FOLDER, WEB_DATA_FOLDER, write_json
from export_map_background import MAPS_FOLDER, rgb

DEM_FILE = RAW_FOLDER / "LDEM_80S_80MPP_ADJ.TIF"
RELIEF_FOLDER = MAPS_FOLDER / "relief"
TILE_PX = 512
HALF_SIZE_M = 304000
FINEST_LEVEL = 4  # 8192 px across 608 km = 74 m/px, about the DEM's native 80 m
COARSE_CONTOUR_INTERVAL_M, FINE_CONTOUR_INTERVAL_M = 500, 250  # fine from level 3 (148 m/px) up
FINE_FROM_LEVEL = 3
INDEX_CONTOUR_EVERY = 4  # every 4th contour (1000 m at the fine interval) is drawn a little stronger
CONTOUR_STRENGTH, INDEX_CONTOUR_STRENGTH = 0.28, 0.5
DISK_85S_RADIUS_M = 151740  # the PGDA 69 square, about 85°S
JPEG_QUALITY = 80
BACKGROUND_RGB = (15, 23, 42)  # slate-900, the map's own background, where the DEM has no data
SUN_ALTITUDE_DEG = 35
SUN_AZIMUTHS_DEG = [225, 270, 315, 360]  # multidirectional: the mean of four lights, so no slope direction is lost in shadow
VERTICAL_EXAGGERATION = 2.0  # the Moon's relief is gentle at these scales
# Muted, colour-blind-safe (cividis) elevation ramp, metres above the 1737.4 km reference sphere → colour. Clamped outside.
ELEVATION_STOPS = [(-6000, "#00204d"), (-4000, "#31446b"), (-2000, "#666970"), (0, "#958f78"), (2500, "#cbba69"), (5000, "#ffea46")]


def contour_interval_m(level):
    return FINE_CONTOUR_INTERVAL_M if level >= FINE_FROM_LEVEL else COARSE_CONTOUR_INTERVAL_M


def tile_bounds_m(level, x, y):
    """[xMin, yMin, xMax, yMax] of a tile in PGDA metres."""
    size = 2 * HALF_SIZE_M // 2**level
    return [-HALF_SIZE_M + x * size, HALF_SIZE_M - (y + 1) * size, -HALF_SIZE_M + (x + 1) * size, HALF_SIZE_M - y * size]


def tile_is_wanted(bounds, disk_radius_m, region_frames):
    """True when the tile touches the disk of radius disk_radius_m around the pole or any region frame [x0, y0, x1, y1]."""
    near_x, near_y = (0 if low <= 0 <= high else min(abs(low), abs(high)) for low, high in ((bounds[0], bounds[2]), (bounds[1], bounds[3])))
    if np.hypot(near_x, near_y) <= disk_radius_m:
        return True
    return any(bounds[0] < frame[2] and frame[0] < bounds[2] and bounds[1] < frame[3] and frame[1] < bounds[3] for frame in region_frames)


def shaded_relief(block, pixel_size_m, altitude_deg=SUN_ALTITUDE_DEG, azimuths_deg=SUN_AZIMUTHS_DEG, exaggeration=1.0):
    """Mean of Lambert shading from several lights for the inside of a block that has a 1-pixel halo; flat ground = sin(altitude)."""
    east_slope = (block[1:-1, 2:] - block[1:-1, :-2]) / (2 * pixel_size_m) * exaggeration
    north_slope = (block[:-2, 1:-1] - block[2:, 1:-1]) / (2 * pixel_size_m) * exaggeration
    norm = np.sqrt(east_slope**2 + north_slope**2 + 1)
    altitude = np.radians(altitude_deg)
    shade = np.zeros(east_slope.shape)
    for azimuth in np.radians(azimuths_deg):
        light = (np.cos(altitude) * np.sin(azimuth), np.cos(altitude) * np.cos(azimuth), np.sin(altitude))
        shade += np.maximum(0, (-east_slope * light[0] - north_slope * light[1] + light[2]) / norm)
    return shade / len(azimuths_deg)


def elevation_tint(elevation_m, stops=ELEVATION_STOPS):
    """Elevations → (…, 3) uint8 colours by linear interpolation between the stops."""
    heights = [height for height, _ in stops]
    channels = np.array([rgb(color) for _, color in stops]).T
    return np.stack([np.rint(np.interp(elevation_m, heights, channel)) for channel in channels], axis=-1).astype(np.uint8)


def contour_strength(block, interval_m):
    """Darkening (0 = none) for the inside of a halo block where the elevation crosses a multiple of interval_m; every 4th is stronger."""
    level = np.floor(block / interval_m)
    centre, east, south = level[1:-1, 1:-1], level[1:-1, 2:], level[2:, 1:-1]
    crossing = ((centre != east) | (centre != south)) & np.isfinite(centre + east + south)
    upper = np.maximum(centre, np.maximum(east, south))
    return np.where(crossing, np.where(upper % INDEX_CONTOUR_EVERY == 0, INDEX_CONTOUR_STRENGTH, CONTOUR_STRENGTH), 0.0)


def render_tile(block, pixel_size_m, contour_interval_m, stops=ELEVATION_STOPS):
    """(h + 2, w + 2) elevations in metres (NaN = no data) → (h, w, 3) uint8: tint × shading, darkened along contours."""
    inside = block[1:-1, 1:-1]
    has_data = np.isfinite(inside)
    if not has_data.any():
        return np.full((*inside.shape, 3), BACKGROUND_RGB, dtype=np.uint8)
    filled = np.where(np.isfinite(block), block, np.nanmean(inside))
    relief = shaded_relief(filled, pixel_size_m, exaggeration=VERTICAL_EXAGGERATION) / np.sin(np.radians(SUN_ALTITUDE_DEG))
    colour = elevation_tint(np.nan_to_num(inside), stops) * np.clip(0.4 + 0.6 * relief, 0, 1.4)[..., None]
    colour *= (1 - contour_strength(block, contour_interval_m))[..., None]
    return np.where(has_data[..., None], np.clip(colour, 0, 255), BACKGROUND_RGB).astype(np.uint8)


def read_level(source, level):
    """The DEM resampled onto the level's grid of 2^level × 2^level tiles."""
    size = TILE_PX * 2**level
    resampling = Resampling.average if size < source.width else Resampling.bilinear
    return source.read(1, out_shape=(size, size), resampling=resampling).astype(np.float32)


def tile_block(level_array, x, y):
    """A tile's elevations with a 1-pixel halo from its neighbours (edge pixels repeated at the map's border)."""
    top, left = y * TILE_PX, x * TILE_PX
    window = level_array[max(top - 1, 0): top + TILE_PX + 1, max(left - 1, 0): left + TILE_PX + 1]
    pad = ((int(top == 0), int(top + TILE_PX == len(level_array))), (int(left == 0), int(left + TILE_PX == len(level_array))))
    return np.pad(window, pad, mode="edge")


def export_level(source, level, region_frames):
    """Writes one level's tiles; returns the list of "x_y" names that exist."""
    level_array = read_level(source, level)
    pixel_size_m = 2 * HALF_SIZE_M / len(level_array)
    names = []
    for y in range(2**level):
        for x in range(2**level):
            if level == FINEST_LEVEL and not tile_is_wanted(tile_bounds_m(level, x, y), DISK_85S_RADIUS_M, region_frames):
                continue
            block = tile_block(level_array, x, y)
            if not np.isfinite(block).any():
                continue
            path = RELIEF_FOLDER / str(level) / f"{x}_{y}.jpg"
            path.parent.mkdir(parents=True, exist_ok=True)
            Image.fromarray(render_tile(block, pixel_size_m, contour_interval_m(level))).save(path, quality=JPEG_QUALITY, optimize=True)
            names.append(f"{x}_{y}")
    return names


def build_index(tiles_by_level):
    return {
        "tileSizePx": TILE_PX,
        "boundsM": [-HALF_SIZE_M, -HALF_SIZE_M, HALF_SIZE_M, HALF_SIZE_M],
        "levels": [{"z": level, "tileSizeM": 2 * HALF_SIZE_M // 2**level, "metersPerPixel": round(2 * HALF_SIZE_M / (TILE_PX * 2**level), 1),
                    "contourIntervalM": contour_interval_m(level), "tiles": names} for level, names in sorted(tiles_by_level.items())],
        "elevationLegend": [{"elevationM": height, "color": color} for height, color in ELEVATION_STOPS],
        "contourIntervalsM": [COARSE_CONTOUR_INTERVAL_M, FINE_CONTOUR_INTERVAL_M],
    }


if __name__ == "__main__":
    regions = json.loads((WEB_DATA_FOLDER / "regions.json").read_text(encoding="utf-8"))["regions"]
    frames = [region["boundsM"] for region in regions]
    shutil.rmtree(RELIEF_FOLDER, ignore_errors=True)
    with rasterio.open(DEM_FILE) as source:
        tiles_by_level = {level: export_level(source, level, frames) for level in range(FINEST_LEVEL + 1)}
    for level, names in tiles_by_level.items():
        total = sum((RELIEF_FOLDER / str(level) / f"{name}.jpg").stat().st_size for name in names)
        print(f"z{level}: {len(names)} tiles, {total / 1e6:.2f} MB")
    write_json(RELIEF_FOLDER / "index.json", build_index(tiles_by_level))
