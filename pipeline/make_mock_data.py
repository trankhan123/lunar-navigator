"""Write FAKE data in the docs/technical-reference.md data contract to web/public/data/mock/ so the web can be built before the pipeline is done.

Every value here is invented (smooth sine waves, random slopes) except the site and region-centre coordinates copied
from pipeline/sites.json. Each file carries "mock": true and the UI must show a MOCK DATA badge.
Run: python pipeline/make_mock_data.py && python pipeline/check_web_data.py web/public/data/mock
"""
from datetime import datetime, timedelta

import numpy as np
from pyproj import Transformer

from common import MAST_HEIGHT_M, MOON_LONLAT_CRS, PGDA_CRS, PSR_LIMIT_FRACTION, SLOPE_LIMIT_DEG, WEB_DATA_FOLDER, load_sites, write_json

MOCK_FOLDER = WEB_DATA_FOLDER / "mock"
START, DAYS = datetime(2028, 1, 1), 213  # covers 2028-01-01 … 2028-07-31 (default 6-month scenario + stay)
GRID_SIZE, CELL_SIZE_M = 7, 1000
REGION_CODE = "MAL"
to_lonlat = Transformer.from_crs(PGDA_CRS, MOON_LONLAT_CRS, always_xy=True)
to_xy = Transformer.from_crs(MOON_LONLAT_CRS, PGDA_CRS, always_xy=True)


def mock_ephemeris():
    days = np.arange(DAYS * 24) / 24
    wave = lambda period_days, phase=0.0: np.sin(2 * np.pi * (days / period_days + phase))
    sun_lon = (180 - 360 * days / 29.530589 + 180) % 360 - 180
    return {
        "mock": True,
        "source": "FAKE sine waves from pipeline/make_mock_data.py, not Horizons",
        "startTime": START.strftime("%Y-%m-%dT%H:%MZ"),
        "stepHours": 1,
        "hours": len(days),
        "sunSubLonDeg": np.round(sun_lon, 2).tolist(),
        "sunSubLatDeg": np.round(1.54 * wave(346.6), 2).tolist(),
        "sunDistanceAu": np.round(1 - 0.0167 * wave(365.25, 0.25), 5).tolist(),
        "earthSubLonDeg": np.round(7.9 * wave(27.55), 2).tolist(),
        "earthSubLatDeg": np.round(6.7 * wave(27.21, 0.1), 2).tolist(),
        "earthDistanceKm": np.round(384400 - 21000 * wave(27.55, 0.25)).astype(int).tolist(),
    }


def mock_cells(region_site):
    random = np.random.default_rng(0)
    centre_x, centre_y = to_xy.transform(region_site["lon"], region_site["lat"])
    azimuth = np.radians(np.arange(360))
    cells = []
    for row in range(GRID_SIZE):
        for column in range(GRID_SIZE):
            x = centre_x + (column - GRID_SIZE // 2) * CELL_SIZE_M
            y = centre_y - (row - GRID_SIZE // 2) * CELL_SIZE_M
            lon, lat = to_lonlat.transform(x, y)
            horizon = 1.2 + 1.0 * np.sin(azimuth - np.radians(30 * row)) + 0.6 * np.sin(2 * azimuth + np.radians(50 * column))
            slope = float(np.round(random.uniform(3, 28), 1))
            psr = float(np.round(0.7 if random.random() < 0.08 else random.uniform(0, 0.1), 2))
            feasible = slope <= SLOPE_LIMIT_DEG and psr <= PSR_LIMIT_FRACTION
            label = f"r{row + 1}c{column + 1}"
            cells.append({
                "id": f"{REGION_CODE}-{label}", "label": label,
                "lat": round(lat, 5), "lon": round(lon, 5), "xM": round(x), "yM": round(y),
                "heightM": round(float(random.uniform(4500, 5500)), 1), "slopeDeg": slope, "psrFraction": psr,
                "psrDistanceKm": round(0.5 * ((row - 2) ** 2 + (column - 3) ** 2) ** 0.5, 1),  # synthetic, no RNG so other mock values stay put
                "feasible": feasible, "infeasibleReason": None if feasible else ("slope" if slope > SLOPE_LIMIT_DEG else "psr"),
                "horizon": np.round(horizon * 10).astype(int).tolist(),
            })
    return cells


def main():
    sites = load_sites()
    region_site = next(site for site in sites if site.get("region") == REGION_CODE)
    cells = mock_cells(region_site)
    xs, ys = [cell["xM"] for cell in cells], [cell["yM"] for cell in cells]
    half = CELL_SIZE_M / 2
    write_json(MOCK_FOLDER / "ephemeris.json", mock_ephemeris())
    write_json(MOCK_FOLDER / f"cells_{REGION_CODE}.json", {
        "mock": True, "region": REGION_CODE, "name": region_site["name"],
        "gridSource": "FAKE 7 × 7 grid, 1 km", "demSource": "FAKE horizons", "mastHeightM": MAST_HEIGHT_M,
        "slopeLimitDeg": SLOPE_LIMIT_DEG, "psrLimitFraction": PSR_LIMIT_FRACTION, "horizonUnitDeg": 0.1, "cells": cells,
    })
    write_json(MOCK_FOLDER / "regions.json", {"mock": True, "regions": [{
        "code": REGION_CODE, "siteId": region_site["id"], "name": region_site["name"],
        "lat": region_site["lat"], "lon": region_site["lon"], "verified": region_site["verified"],
        "cellCount": len(cells), "feasibleCount": sum(cell["feasible"] for cell in cells),
        "cellsFile": f"cells_{REGION_CODE}.json", "boundsM": [min(xs) - half, min(ys) - half, max(xs) + half, max(ys) + half],
    }]})
    write_json(MOCK_FOLDER / "sites.json", {"mock": True, "sites": [
        {key: site.get(key) for key in ["id", "name", "group", "lat", "lon", "region", "source", "verified"]}
        | {"hasTerrain": False, "horizon": None}
        for site in sites
    ]})
    write_json(MOCK_FOLDER / "validation.json", {
        "mock": True,
        "pgda69": [],  # no fake comparison rows: the validation badge and chart simply stay hidden in mock mode
        "horizons": {"pointCount": 0, "maxAzimuthErrorDeg": None, "maxElevationErrorDeg": None, "checkedAt": None},
        "quickmap": [],
    })


if __name__ == "__main__":
    main()
