"""D9 — Whole-cap 2 km grid (CAP): every 2 km cell south of 85°S that the 9 LGRS regions do not already cover.

Contract: README "D9". Run: python pipeline/build_cap_grid.py [--limit N] [--jobs N]
Input:  pipeline/raw DEMs, slope and PSR rasters (same as D3/D4), web/public/data/regions.json (boundsM to exclude)
        --rebuild-tiles skips all computing and rewrites the tiles from the committed pipeline/out/*_CAP.json (use after E7).
Output: pipeline/out/grid_CAP.json, feasibility_CAP.json (same shapes as the region files; horizons are not kept, they live in the web tiles),
        web/public/data/cap/index.json and cap_<tx>_<ty>.json (40 km tiles of finished cells).
Feasibility is D3 (compute_feasibility) on the 2 km square, horizon is D4 (compute_horizon) with its defaults, the cell
is assembled by D5's build_cell, so rules, rounding and reason codes cannot drift from the regions.
"""
import argparse
import json
import math
import os
from pathlib import Path
from multiprocessing import get_context

import numpy as np
from pyproj import Transformer

import compute_feasibility as feasibility_module
import compute_horizon as horizon_module
from build_site_data import build_cell
from common import MOON_LONLAT_CRS, OUT_FOLDER, PGDA_CRS, RAW_FOLDER, REGION_CODES, WEB_DATA_FOLDER, write_json

CELL_SIZE_M = 2000
TILE_SIZE_M = 40000
SOUTH_OF_LAT_DEG = -85  # default; --south-of overrides (the 80 m rasters cover 80°S and south, a ±304 km square)
COVERAGE_RADIUS_M = 303000  # cells (2 km box) must lie inside the raster square
CAP_FOLDER = WEB_DATA_FOLDER / "cap"
TO_PGDA = Transformer.from_crs(MOON_LONLAT_CRS, PGDA_CRS, always_xy=True)
TO_LONLAT = Transformer.from_crs(PGDA_CRS, MOON_LONLAT_CRS, always_xy=True)
NEAR_DEM = FAR_DEM = None  # loaded once in main, shared with the worker processes by fork


def select_cell_indices(radius_m, excluded_bounds):
    """(i, j) of every square whose centre ((i+0.5)·2000, (j+0.5)·2000) is within radius_m of the pole and outside every bounds box."""
    limit = math.ceil(radius_m / CELL_SIZE_M) + 1
    i, j = np.meshgrid(np.arange(-limit, limit), np.arange(-limit, limit), indexing="ij")
    x, y = (i + 0.5) * CELL_SIZE_M, (j + 0.5) * CELL_SIZE_M
    keep = np.hypot(x, y) <= radius_m
    for x_min, y_min, x_max, y_max in excluded_bounds:
        keep &= ~((x_min <= x) & (x <= x_max) & (y_min <= y) & (y <= y_max))
    return [(int(a), int(b)) for a, b in zip(i[keep], j[keep])]


def cell_id(row, column):
    return f"CAP-r{row:03d}c{column:03d}"


def make_grid_cells(indices):
    """Grid cells (id, label, lat, lon, xM, yM), row by row; row = j - jMin, column = i - iMin."""
    i_min = min(i for i, _ in indices)
    j_min = min(j for _, j in indices)
    cells = []
    for i, j in sorted(indices, key=lambda index: (index[1], index[0])):
        x_m, y_m = (i + 0.5) * CELL_SIZE_M, (j + 0.5) * CELL_SIZE_M
        lon, lat = TO_LONLAT.transform(x_m, y_m)
        identifier = cell_id(j - j_min, i - i_min)
        cells.append({"id": identifier, "label": identifier.removeprefix("CAP-"),
                      "lat": round(lat, 5), "lon": round(lon, 5), "xM": float(x_m), "yM": float(y_m)})
    return cells


def tile_of(x_m, y_m):
    return math.floor(x_m / TILE_SIZE_M), math.floor(y_m / TILE_SIZE_M)


def tile_bounds(tile_x, tile_y):
    return [tile_x * TILE_SIZE_M, tile_y * TILE_SIZE_M, (tile_x + 1) * TILE_SIZE_M, (tile_y + 1) * TILE_SIZE_M]


def split_into_tiles(cells):
    tiles = {}
    for cell in cells:
        tiles.setdefault(tile_of(cell["xM"], cell["yM"]), []).append(cell)
    return tiles


def build_index(tiles, excluded_region_codes, south_of_lat_deg=SOUTH_OF_LAT_DEG):
    entries = [{"id": f"cap_{tx}_{ty}", "boundsM": tile_bounds(tx, ty), "cellCount": len(cells),
                "feasibleCount": sum(cell["feasible"] for cell in cells)} for (tx, ty), cells in sorted(tiles.items())]
    xs = [cell["xM"] for cells in tiles.values() for cell in cells]
    grid_size = round((max(xs) - min(xs)) / CELL_SIZE_M) + 1  # cells per side of the id/raster square (x and y spans match)
    return {"cellSizeM": CELL_SIZE_M, "gridSize": grid_size, "tileSizeM": TILE_SIZE_M, "southOfLatDeg": south_of_lat_deg,
            "excludedRegionCodes": excluded_region_codes, "cellCount": sum(e["cellCount"] for e in entries),
            "feasibleCount": sum(e["feasibleCount"] for e in entries), "tiles": entries}


def horizon_of_cell(cell):
    return horizon_module.compute_horizon(cell["lat"], cell["lon"], NEAR_DEM, FAR_DEM, x_m=cell["xM"], y_m=cell["yM"])


def compute_horizons(cells, jobs):
    horizons = []
    with get_context("fork").Pool(jobs) as pool:  # fork (not the 3.14 default) so workers inherit the loaded DEMs
        for count, horizon in enumerate(pool.imap(horizon_of_cell, cells, chunksize=10), start=1):
            horizons.append(horizon)
            if count % 500 == 0:
                print(f"horizon {count}/{len(cells)}", flush=True)
    return horizons


def write_tiles(cells, feasibility, horizon_by_id, south_of_lat_deg=SOUTH_OF_LAT_DEG):
    science = json.loads((OUT_FOLDER / "science_CAP.json").read_text()) if (OUT_FOLDER / "science_CAP.json").exists() else {}
    finished = [build_cell(cell, feasibility[cell["id"]], horizon_by_id[cell["id"]], science.get(cell["id"])) for cell in cells]
    tiles = split_into_tiles(finished)
    for (tile_x, tile_y), tile_cells in tiles.items():
        tile_id = f"cap_{tile_x}_{tile_y}"
        write_json(CAP_FOLDER / f"{tile_id}.json", {"tileId": tile_id, "cells": tile_cells})
    write_json(CAP_FOLDER / "index.json", build_index(tiles, REGION_CODES, south_of_lat_deg))


def main():
    global NEAR_DEM, FAR_DEM
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--limit", type=int, help="only N cells spread over the cap (timing test, nothing is written)")
    parser.add_argument("--jobs", type=int, default=1)
    parser.add_argument("--south-of", type=float, default=SOUTH_OF_LAT_DEG, help="outer edge latitude, -80 at the most")
    parser.add_argument("--raw-folder", type=Path, default=RAW_FOLDER, help="folder with the DEM, slope and PSR rasters")
    parser.add_argument("--feasibility-out", type=Path, help="with --limit: also write the feasibility dict here (identity checks)")
    parser.add_argument("--rebuild-tiles", action="store_true", help="rewrite web tiles from pipeline/out/*_CAP.json and the horizons already in the tiles, no DEM needed")
    args = parser.parse_args()

    if args.rebuild_tiles:
        cells, feasibility = (json.loads((OUT_FOLDER / f"{kind}_CAP.json").read_text()) for kind in ("grid", "feasibility"))
        horizon_by_id = {cell["id"]: cell["horizon"] for tile in CAP_FOLDER.glob("cap_*.json") for cell in json.loads(tile.read_text())["cells"]}
        index = json.loads((CAP_FOLDER / "index.json").read_text())
        write_tiles(cells, feasibility, horizon_by_id, index["southOfLatDeg"])
        return
    if args.south_of > -80:
        parser.error("--south-of must be -80 or further south (data coverage)")
    names = ("LDSM_80S_80MPP_ADJ.TIF", "LPSR_80S_20MPP_ADJ.TIF", "LDEM_80S_80MPP_ADJ.TIF")
    feasibility_module.SLOPE_FILE, feasibility_module.PSR_FILE, feasibility_module.DEM_FILE = (args.raw_folder / name for name in names)
    horizon_module.NEAR_DEM_PATH, horizon_module.FAR_DEM_PATH = args.raw_folder / names[2], args.raw_folder / "LDEM_60S_240MPP_ADJ.TIF"

    bounds = [region["boundsM"] for region in json.loads((WEB_DATA_FOLDER / "regions.json").read_text())["regions"]]
    radius_m = math.hypot(*TO_PGDA.transform(0, args.south_of))
    radius_m = min(radius_m, COVERAGE_RADIUS_M)
    cells = make_grid_cells(select_cell_indices(radius_m, bounds))
    print(f"{len(cells)} cells south of {args.south_of}° outside the {len(bounds)} regions (radius {radius_m / 1000:.1f} km)", flush=True)
    if args.limit:
        cells = cells[::max(1, len(cells) // args.limit)][:args.limit]

    sources = (feasibility_module.SLOPE_FILE, feasibility_module.PSR_FILE, feasibility_module.DEM_FILE)
    feasibility = {}
    for batch in split_into_tiles(cells).values():  # one 40 km tile at a time: the 20 m PSR raster is 3.7 GB in full
        rasters = [feasibility_module.read_region(path, batch, margin_m=3 * CELL_SIZE_M) for path in sources]
        feasibility.update({cell["id"]: feasibility_module.compute_cell_feasibility(cell, *rasters, CELL_SIZE_M / 2) for cell in batch})
        del rasters
    print("feasibility done", flush=True)
    NEAR_DEM, FAR_DEM = horizon_module.load_dem(horizon_module.NEAR_DEM_PATH), horizon_module.load_dem(horizon_module.FAR_DEM_PATH)
    horizons = compute_horizons(cells, args.jobs)
    if args.limit:
        if args.feasibility_out:
            args.feasibility_out.write_text(json.dumps(feasibility, sort_keys=True))
        print(f"computed {len(cells)} cells, not writing")
        return

    horizon_by_id = dict(zip((cell["id"] for cell in cells), horizons))
    write_json(OUT_FOLDER / "grid_CAP.json", cells)
    write_json(OUT_FOLDER / "feasibility_CAP.json", feasibility)
    write_tiles(cells, feasibility, horizon_by_id, args.south_of)


if __name__ == "__main__":
    main()
