"""D5 — Build web data: merge grid + feasibility + horizon into the files the browser loads.

Contract: README "Data files". Run: python pipeline/build_site_data.py && python pipeline/check_web_data.py
Input:  pipeline/out/grid_<CODE>.json, feasibility_<CODE>.json, horizon_<CODE>.json, science_<CODE>.json (E7), horizon_sites.json, pipeline/sites.json
Output: web/public/data/regions.json, web/public/data/cells_<CODE>.json, web/public/data/sites.json (each < 2 MB)
Rules:  feasible = slopeDeg ≤ SLOPE_LIMIT_DEG and psrFraction ≤ PSR_LIMIT_FRACTION, on the rounded values D3 wrote;
        infeasibleReason = "slope" first, then "psr", else null.
        Regions with a missing input file are left out with a warning. A region whose cells file would pass 2 MB
        keeps only the KEPT_CELL_COUNT cells nearest its centre (team decision 14/11: Mons Mouton Plateau, 4524 → 900).
"""
import json
import math

from pyproj import Transformer

from common import (MAST_HEIGHT_M, MOON_LONLAT_CRS, OUT_FOLDER, PGDA_CRS, PSR_LIMIT_FRACTION, SLOPE_LIMIT_DEG,
                    WEB_DATA_FOLDER, artemis_regions, load_sites, write_json)

MAX_FILE_BYTES = 2_000_000
KEPT_CELL_COUNT = 900  # about the size of Haworth, so the browser search stays as fast as there
CELL_HALF_SIZE_M = 500  # README regions.json: boundsM = cell centres ± 500 m
SITE_KEYS = ["id", "name", "group", "lat", "lon", "region", "source", "verified"]
TO_PGDA = Transformer.from_crs(MOON_LONLAT_CRS, PGDA_CRS, always_xy=True)


def read_out(file_name):
    path = OUT_FOLDER / file_name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def json_bytes(data):
    return len(json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode())


def keep_nearest_cells(cells, region_site, count):
    """The `count` cells nearest the region centre, in their original grid order."""
    centre_x, centre_y = TO_PGDA.transform(region_site["lon"], region_site["lat"])
    nearest = sorted(cells, key=lambda cell: math.hypot(cell["xM"] - centre_x, cell["yM"] - centre_y))[:count]
    kept_ids = {cell["id"] for cell in nearest}
    return [cell for cell in cells if cell["id"] in kept_ids]


def build_cell(grid_cell, feasibility, horizon, psr_distance_km=None):
    reason = "slope" if feasibility["slopeDeg"] > SLOPE_LIMIT_DEG else "psr" if feasibility["psrFraction"] > PSR_LIMIT_FRACTION else None
    return {**grid_cell, **feasibility, "psrDistanceKm": psr_distance_km, "feasible": reason is None, "infeasibleReason": reason, "horizon": horizon}


def build_region(region_site):
    """(regions.json entry, cells_<CODE>.json content), or None when an input file is missing."""
    code = region_site["region"]
    inputs = {kind: read_out(f"{kind}_{code}.json") for kind in ("grid", "feasibility", "horizon")}
    science = read_out(f"science_{code}.json") or {}  # E7, optional
    missing = [f"{kind}_{code}.json" for kind, data in inputs.items() if data is None]
    if missing:
        print(f"warning: skip {code}, missing {', '.join(missing)}")
        return None
    cells = [build_cell(cell, inputs["feasibility"][cell["id"]], inputs["horizon"][cell["id"]], science.get(cell["id"])) for cell in inputs["grid"]]
    if json_bytes(cells) > MAX_FILE_BYTES:
        print(f"note: {code} has {len(cells)} cells ({json_bytes(cells) / 1e6:.1f} MB), keeping the {KEPT_CELL_COUNT} nearest its centre")
        cells = keep_nearest_cells(cells, region_site, KEPT_CELL_COUNT)
    cells_file = {
        "region": code, "name": region_site["name"],
        "gridSource": "USGS LGRS ACC 1 km grid, McClernan 2024, doi:10.5066/P1MEQ6UK",
        "demSource": "LOLA PGDA 90: LDEM_80S_80MPP_ADJ + LDEM_60S_240MPP_ADJ",
        "mastHeightM": MAST_HEIGHT_M, "slopeLimitDeg": SLOPE_LIMIT_DEG, "psrLimitFraction": PSR_LIMIT_FRACTION, "horizonUnitDeg": 0.1,
        "cells": cells,
    }
    xs = [cell["xM"] for cell in cells]
    ys = [cell["yM"] for cell in cells]
    region = {
        "code": code, "siteId": region_site["id"], "name": region_site["name"], "lat": region_site["lat"], "lon": region_site["lon"],
        "verified": region_site["verified"], "cellCount": len(cells), "feasibleCount": sum(cell["feasible"] for cell in cells),
        "cellsFile": f"cells_{code}.json",
        "boundsM": [min(xs) - CELL_HALF_SIZE_M, min(ys) - CELL_HALF_SIZE_M, max(xs) + CELL_HALF_SIZE_M, max(ys) + CELL_HALF_SIZE_M],
    }
    return region, cells_file


def build_sites():
    """Every site with coordinates; sites inside the 60°S DEM get their D4 horizon."""
    horizons = read_out("horizon_sites.json") or {}
    sites = []
    for site in load_sites():
        horizon = horizons.get(site["id"]) if site["lat"] <= -60 else None
        if site["lat"] <= -60 and horizon is None:
            print(f"warning: {site['id']} is inside the DEM but has no horizon (run compute_horizon.py --sites)")
        sites.append({**{key: site[key] for key in SITE_KEYS}, "hasTerrain": horizon is not None, "horizon": horizon})
    return {"sites": sites}


if __name__ == "__main__":
    print(f"slope limit {SLOPE_LIMIT_DEG}°, PSR limit {PSR_LIMIT_FRACTION}")
    regions = []
    for region_site in artemis_regions():
        built = build_region(region_site)
        if built is None:
            continue
        region, cells_file = built
        size_bytes = json_bytes(cells_file)
        if size_bytes > MAX_FILE_BYTES:
            print(f"warning: skip {region['code']}, {region['cellCount']} cells make {size_bytes / 1e6:.1f} MB, over the 2 MB limit "
                  "(README: tell the team before changing the format)")
            continue
        print(f"{region['code']}: {region['feasibleCount']} of {region['cellCount']} cells feasible")
        write_json(WEB_DATA_FOLDER / region["cellsFile"], cells_file)
        regions.append(region)
    write_json(WEB_DATA_FOLDER / "regions.json", {"regions": regions})
    write_json(WEB_DATA_FOLDER / "sites.json", build_sites())
