"""D3 — Landing feasibility per cell: height, median slope, permanent-shadow share.

Contract: README "D3 Feasibility". Run: python pipeline/compute_feasibility.py [--region MAL]
Input:  pipeline/out/grid_<CODE>.json
        pipeline/raw/LDSM_80S_80MPP_ADJ.TIF (slope, degrees), pipeline/raw/LPSR_80S_20MPP_ADJ.TIF (permanent shadow, 0/1),
        pipeline/raw/LDEM_80S_80MPP_ADJ.TIF (height, metres). All three are in common.PGDA_CRS.
Output: pipeline/out/feasibility_<CODE>.json = {"<cellId>": {"heightM", "slopeDeg", "psrFraction"}}
        slopeDeg = median over the 1 km square; psrFraction = share of PSR pixels in the square; heightM = DEM at the centre
        (bilinear). Values are already rounded (0.1 m, 0.1°, 0.001), so D5 applies the feasibility rule to them as written.
"""
import argparse
import json
import math

import numpy as np
import rasterio
from rasterio.windows import from_bounds

from common import OUT_FOLDER, RAW_FOLDER, REGION_CODES, write_json

SLOPE_FILE = RAW_FOLDER / "LDSM_80S_80MPP_ADJ.TIF"
PSR_FILE = RAW_FOLDER / "LPSR_80S_20MPP_ADJ.TIF"
DEM_FILE = RAW_FOLDER / "LDEM_80S_80MPP_ADJ.TIF"
# An LGRS square is 1000 m in LPS units; LPS has scale 0.994 against PGDA_CRS on the same sphere.
SQUARE_HALF_SIZE_M = 500 / 0.994


def read_region(path, cells, margin_m=1000):
    """Read only the part of a raster around the region (the PSR raster is 3.7 GB in full)."""
    xs = [cell["xM"] for cell in cells]
    ys = [cell["yM"] for cell in cells]
    with rasterio.open(path) as source:
        left, bottom, right, top = source.bounds  # clamp: the 80°S rasters end at ±304 km, the cap grid reaches that edge
        window = from_bounds(max(min(xs) - margin_m, left), max(min(ys) - margin_m, bottom), min(max(xs) + margin_m, right), min(max(ys) + margin_m, top), source.transform)
        window = window.round_offsets().round_lengths()
        return source.read(1, window=window), source.window_transform(window)


def pixels_in_square(raster, x, y, half_size_m=SQUARE_HALF_SIZE_M):
    """Pixels whose centres lie inside the square of half size half_size_m around (x, y)."""
    values, transform = raster
    size = transform.a  # north-up rasters: pixel width = height = a, top edge = f
    first_column = math.ceil((x - half_size_m - transform.c) / size - 0.5)
    last_column = math.floor((x + half_size_m - transform.c) / size - 0.5)
    first_row = math.ceil((transform.f - (y + half_size_m)) / size - 0.5)
    last_row = math.floor((transform.f - (y - half_size_m)) / size - 0.5)
    return values[first_row:last_row + 1, first_column:last_column + 1]


def bilinear(raster, x, y):
    values, transform = raster
    column = (x - transform.c) / transform.a - 0.5
    row = (transform.f - y) / transform.a - 0.5
    left, top = math.floor(column), math.floor(row)
    dx, dy = column - left, row - top
    block = values[top:top + 2, left:left + 2]
    return (block[0, 0] * (1 - dx) * (1 - dy) + block[0, 1] * dx * (1 - dy)
            + block[1, 0] * (1 - dx) * dy + block[1, 1] * dx * dy)


def compute_cell_feasibility(cell, slope_raster, psr_raster, dem_raster, half_size_m=SQUARE_HALF_SIZE_M):
    slopes = pixels_in_square(slope_raster, cell["xM"], cell["yM"], half_size_m)
    shadow = pixels_in_square(psr_raster, cell["xM"], cell["yM"], half_size_m)
    height = bilinear(dem_raster, cell["xM"], cell["yM"])
    if slopes.size == 0 or shadow.size == 0 or np.isnan(slopes).all() or np.isnan(height):
        raise ValueError(f"{cell['id']}: no raster data in the square")
    return {
        "heightM": round(float(height), 1),
        "slopeDeg": round(float(np.nanmedian(slopes)), 1),
        "psrFraction": round(float(np.mean(shadow > 0.5)), 3),
    }


def compute_region(code):
    cells = json.loads((OUT_FOLDER / f"grid_{code}.json").read_text(encoding="utf-8"))
    rasters = [read_region(path, cells) for path in (SLOPE_FILE, PSR_FILE, DEM_FILE)]
    return {cell["id"]: compute_cell_feasibility(cell, *rasters) for cell in cells}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--region", choices=REGION_CODES, help="one region (default: every region with a grid)")
    args = parser.parse_args()
    for code in [args.region] if args.region else REGION_CODES:
        if not (OUT_FOLDER / f"grid_{code}.json").exists():
            print(f"warning: skip {code}, no grid yet (run build_grid.py)")
            continue
        feasibility = compute_region(code)
        slopes = [value["slopeDeg"] for value in feasibility.values()]
        print(f"{code}: {len(feasibility)} cells, median slope {np.median(slopes):.1f}°, "
              f"{sum(value['psrFraction'] > 0.5 for value in feasibility.values())} mostly in shadow")
        write_json(OUT_FOLDER / f"feasibility_{code}.json", feasibility)
