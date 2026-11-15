"""E7 — Distance from every cell to the nearest permanent shadow (cold trap) of at least 1 km².

Contract: README "Data files" (cell field psrDistanceKm).
Run: python pipeline/compute_science_access.py [path/to/LPSR_80S_20MPP_ADJ.TIF] [--limit N]
Input:  LPSR_80S_20MPP_ADJ.TIF (PGDA 90, 20 m, 80-90°S), pipeline/out/grid_<CODE>.json and grid_CAP.json
Output: pipeline/out/science_<CODE>.json and science_CAP.json: {cell id: psrDistanceKm} (0 inside a PSR, null outside the raster)
The mask is read at 100 m (a 100 m pixel is PSR when any 20 m pixel in it is) and polygonised; PSRs under 1 km² are dropped.
"""
import argparse
import json
import time

import numpy as np
import rasterio
from rasterio.features import shapes
from rasterio.windows import Window
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

from common import OUT_FOLDER, RAW_FOLDER, REGION_CODES, write_json

MIN_AREA_KM2 = 1.0  # PGDA 90 lists the PSRs of 1 km² and larger
DECIMATION = 5  # 20 m -> 100 m


def load_psr_polygons(mask_path):
    """(polygons of PSRs >= MIN_AREA_KM2 in PGDA metres, raster bounds)."""
    with rasterio.open(mask_path) as source:
        # rasterio reads cannot use Resampling.max, so take the max of each 5x5 block by hand, strip by strip
        strips = []
        for top in range(0, source.height - source.height % DECIMATION, 100 * DECIMATION):
            height = min(100 * DECIMATION, source.height - source.height % DECIMATION - top)
            values = source.read(1, window=Window(0, top, source.width - source.width % DECIMATION, height))
            strips.append((values > 0.5).reshape(height // DECIMATION, DECIMATION, -1, DECIMATION).max(axis=(1, 3)))  # nan counts as not PSR
        mask = np.vstack(strips)
        transform = source.transform * source.transform.scale(DECIMATION)
        bounds = source.bounds
    parts = [shape(geometry) for geometry, value in shapes(mask.astype("uint8"), transform=transform) if value == 1]
    return [part for part in parts if part.area >= MIN_AREA_KM2 * 1e6], bounds


def distances_km(cells, polygons, bounds):
    tree = STRtree(polygons)
    result = {}
    for cell in cells:
        x, y = cell["xM"], cell["yM"]
        inside_raster = bounds.left <= x <= bounds.right and bounds.bottom <= y <= bounds.top
        if inside_raster:
            result[cell["id"]] = round(float(tree.query_nearest(Point(x, y), return_distance=True, all_matches=False)[1][0]) / 1000, 1)
        else:
            result[cell["id"]] = None
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("mask", nargs="?", default=RAW_FOLDER / "LPSR_80S_20MPP_ADJ.TIF")
    parser.add_argument("--limit", type=int, help="timing test: only N cells of MAL, nothing is written")
    args = parser.parse_args()

    start = time.time()
    polygons, bounds = load_psr_polygons(args.mask)
    print(f"kept {len(polygons)} PSR polygons >= {MIN_AREA_KM2} km² ({time.time() - start:.0f} s)")
    for code in ["MAL"] if args.limit else REGION_CODES + ["CAP"]:
        path = OUT_FOLDER / f"grid_{code}.json"
        if not path.exists():
            print(f"warning: skip {code}, no {path.name}")
            continue
        cells = json.loads(path.read_text(encoding="utf-8"))[:args.limit]
        distances = distances_km(cells, polygons, bounds)
        known = [value for value in distances.values() if value is not None]
        print(f"{code}: {len(cells)} cells, distance {min(known):.1f}..{max(known):.1f} km, {len(cells) - len(known)} null ({time.time() - start:.0f} s)")
        if not args.limit:
            write_json(OUT_FOLDER / f"science_{code}.json", distances)
