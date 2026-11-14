"""Check that a data folder follows the README data contract. Real and mock data must both pass.

Run: python pipeline/check_web_data.py                       (web/public/data, plus web/public/maps/maps.json)
     python pipeline/check_web_data.py web/public/data/mock  (mock data: every file must say "mock": true; no maps)
Exit code 1 and a list of problems when something is wrong.
"""
import json
import math
import re
import sys
from datetime import date
from pathlib import Path

from pyproj import Transformer

from common import (EPHEMERIS_START, EPHEMERIS_STOP, MOON_LONLAT_CRS, PGDA_CRS, PSR_LIMIT_FRACTION, REGION_CODES,
                    SLOPE_LIMIT_DEG, WEB_DATA_FOLDER)

MAX_FILE_BYTES = 2_000_000
MAX_IMAGE_BYTES = 1_000_000
MAX_TERRAIN_BYTES = 300_000
MAP_KINDS = {"hillshade", "sun-visibility", "earth-visibility", "psr"}
MAX_POSITION_ERROR_M = 100
CELL_HALF_SIZE_M = 500  # boundsM must contain whole 1 km squares, not only their centres
ISO_HOUR = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:00Z$")
EPHEMERIS_START_TIME = f"{EPHEMERIS_START}T00:00Z"
EPHEMERIS_HOURS = ((date.fromisoformat(EPHEMERIS_STOP) - date.fromisoformat(EPHEMERIS_START)).days + 1) * 24
EPHEMERIS_ARRAYS = ["sunSubLonDeg", "sunSubLatDeg", "sunDistanceAu", "earthSubLonDeg", "earthSubLatDeg", "earthDistanceKm"]
CELL_KEYS = ["id", "label", "lat", "lon", "xM", "yM", "heightM", "slopeDeg", "psrFraction", "feasible", "infeasibleReason", "horizon"]
SITE_GROUPS = {"artemis-region", "apollo", "clps", "international"}
TO_POLAR_XY = Transformer.from_crs(MOON_LONLAT_CRS, PGDA_CRS, always_xy=True)
problems = []
loaded_files = set()


def problem(file_name, message):
    problems.append(f"{file_name}: {message}")


def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def in_range(value, low, high):
    return is_number(value) and low <= value <= high


def load(folder, file_name, expect_mock, required=True):
    loaded_files.add(file_name)
    path = folder / file_name
    if not path.exists():
        if required:
            problem(file_name, "missing")
        return None
    if path.stat().st_size > MAX_FILE_BYTES:
        problem(file_name, f"{path.stat().st_size / 1e6:.1f} MB, limit is 2 MB")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        problem(file_name, f"not valid JSON ({error})")
        return None
    if not isinstance(data, dict):
        problem(file_name, "top level must be an object")
        return None
    if bool(data.get("mock")) != expect_mock:
        problem(file_name, f'"mock" must be {str(expect_mock).lower()} in this folder')
    return data


def check_horizon(file_name, owner, horizon):
    if horizon is None:
        return
    if not (isinstance(horizon, list) and len(horizon) == 360 and all(type(v) is int and -900 <= v <= 900 for v in horizon)):
        problem(file_name, f"{owner}: horizon must be null or 360 integers in 0.1° units")


def check_ephemeris(data, expect_mock):
    name = "ephemeris.json"
    if not ISO_HOUR.match(str(data.get("startTime"))):
        problem(name, "startTime must look like 2027-01-01T00:00Z")
    if type(data.get("stepHours")) is not int or data["stepHours"] != 1:
        problem(name, "stepHours must be 1")
    hours = data.get("hours")
    if type(hours) is not int or hours <= 0:
        problem(name, "hours must be a positive integer")
        return
    if not expect_mock and (data.get("startTime"), hours) != (EPHEMERIS_START_TIME, EPHEMERIS_HOURS):
        problem(name, f"must start at {EPHEMERIS_START_TIME} and cover {EPHEMERIS_HOURS} hours (to {EPHEMERIS_STOP} 23:00)")
    for key in EPHEMERIS_ARRAYS:
        values = data.get(key)
        if not isinstance(values, list) or len(values) != hours:
            problem(name, f"{key} must be a list of length hours ({hours})")
            continue
        low, high = {"Lon": (-180, 180), "Lat": (-90, 90), "Au": (0.9, 1.1), "Km": (3.4e5, 4.1e5)}[re.search("Lon|Lat|Au|Km", key)[0]]
        if not all(in_range(v, low, high) for v in values):
            problem(name, f"{key} has values outside {low}..{high}")


def check_cell(file_name, code, cell):
    """One grid cell. Returns its (xM, yM) when the cell is valid enough to bound the region, else None."""
    cell_id = cell.get("id", "?")
    if sorted(cell) != sorted(CELL_KEYS):
        problem(file_name, f"{cell_id}: keys must be exactly {CELL_KEYS}")
        return None
    if not isinstance(cell_id, str) or cell_id != f"{code}-{cell['label']}":
        problem(file_name, f"{cell_id}: id must equal '{code}-' + label")
    if not (in_range(cell["lat"], -90, -60) and in_range(cell["lon"], -180, 180) and is_number(cell["xM"]) and is_number(cell["yM"])):
        problem(file_name, f"{cell_id}: lat/lon/xM/yM missing or out of range")
        return None
    x, y = TO_POLAR_XY.transform(cell["lon"], cell["lat"])
    if math.hypot(x - cell["xM"], y - cell["yM"]) > MAX_POSITION_ERROR_M:
        problem(file_name, f"{cell_id}: xM/yM do not match lat/lon in the PGDA projection (swapped axes?)")
    if not (in_range(cell["slopeDeg"], 0, 90) and in_range(cell["psrFraction"], 0, 1) and is_number(cell["heightM"])):
        problem(file_name, f"{cell_id}: heightM must be a number, slopeDeg 0..90, psrFraction 0..1")
        return None
    # Rule applied to the rounded values written in the file (README "cells_<CODE>.json").
    expected = cell["slopeDeg"] <= SLOPE_LIMIT_DEG and cell["psrFraction"] <= PSR_LIMIT_FRACTION
    reason = None if expected else ("slope" if cell["slopeDeg"] > SLOPE_LIMIT_DEG else "psr")
    if cell["feasible"] is not expected or cell["infeasibleReason"] != reason:
        problem(file_name, f"{cell_id}: feasible/infeasibleReason do not match slope and PSR limits")
    check_horizon(file_name, cell_id, cell["horizon"])
    if cell["horizon"] is None:
        problem(file_name, f"{cell_id}: grid cells must have a horizon")
    return cell["xM"], cell["yM"]


def check_cells(data, file_name, code):
    if data.get("region") != code:
        problem(file_name, f'region must be "{code}"')
    if data.get("horizonUnitDeg") != 0.1:
        problem(file_name, "horizonUnitDeg must be 0.1")
    if (data.get("slopeLimitDeg"), data.get("psrLimitFraction")) != (SLOPE_LIMIT_DEG, PSR_LIMIT_FRACTION):
        problem(file_name, f"slopeLimitDeg/psrLimitFraction must equal common.py ({SLOPE_LIMIT_DEG}, {PSR_LIMIT_FRACTION})")
    cells = data.get("cells")
    if not isinstance(cells, list) or not cells:
        problem(file_name, "cells must be a non-empty list")
        return (0, 0), []
    ids = [cell.get("id") for cell in cells]
    if len(set(ids)) != len(ids):
        problem(file_name, "cell ids must be unique")
    positions = [position for cell in cells if (position := check_cell(file_name, code, cell))]
    return (len(cells), sum(cell.get("feasible") is True for cell in cells)), positions


def check_regions(data, folder, expect_mock):
    regions = data.get("regions")
    if not isinstance(regions, list) or not regions:
        problem("regions.json", "regions must be a non-empty list")
        return
    for region in regions:
        code = region.get("code")
        if code not in REGION_CODES:
            problem("regions.json", f"unknown region code {code}")
            continue
        if not (isinstance(region.get("name"), str) and region["name"].strip()):
            problem("regions.json", f"{code}: name must be a non-empty string")
        bounds = region.get("boundsM")
        if not (isinstance(bounds, list) and len(bounds) == 4 and all(is_number(v) for v in bounds)):
            problem("regions.json", f"{code}: boundsM must be 4 numbers [xMin, yMin, xMax, yMax]")
            bounds = None
        if region.get("cellsFile") != f"cells_{code}.json":
            problem("regions.json", f"{code}: cellsFile must be cells_{code}.json")
            continue
        cells = load(folder, region["cellsFile"], expect_mock)
        if cells is None:
            continue
        counts, positions = check_cells(cells, region["cellsFile"], code)
        if counts != (region.get("cellCount"), region.get("feasibleCount")):
            problem("regions.json", f"{code}: cellCount/feasibleCount {region.get('cellCount')}/{region.get('feasibleCount')} but file has {counts}")
        half = CELL_HALF_SIZE_M
        if bounds and positions and not all(bounds[0] <= x - half and x + half <= bounds[2] and bounds[1] <= y - half and y + half <= bounds[3] for x, y in positions):
            problem("regions.json", f"{code}: boundsM must contain the outer edges of every cell (centre ± 500 m)")


def check_sites(data, expect_mock):
    sites = data.get("sites")
    if not isinstance(sites, list) or not sites:
        problem("sites.json", "sites must be a non-empty list")
        return
    seen = set()
    for site in sites:
        site_id = site.get("id", "?")
        if site_id in seen or site.get("group") not in SITE_GROUPS:
            problem("sites.json", f"{site_id}: duplicate id or unknown group")
        seen.add(site_id)
        if site.get("source") == "TODO":
            problem("sites.json", f"{site_id}: TODO site must not be published")
        if not (in_range(site.get("lat"), -90, 90) and in_range(site.get("lon"), -180, 180)):
            problem("sites.json", f"{site_id}: lat/lon missing or out of range")
            continue
        if site.get("region") is not None and site["region"] not in REGION_CODES:
            problem("sites.json", f"{site_id}: unknown region")
        if site.get("hasTerrain") is not (site.get("horizon") is not None):
            problem("sites.json", f"{site_id}: hasTerrain must be true exactly when horizon is given")
        if not expect_mock and site["lat"] <= -60 and site.get("horizon") is None:
            problem("sites.json", f"{site_id}: sites at lat ≤ −60° are inside the DEM and need a horizon (D4)")
        check_horizon("sites.json", site_id, site.get("horizon"))


def check_validation(data, expect_mock):
    if not (isinstance(data.get("pgda69"), list) and isinstance(data.get("horizons"), dict) and isinstance(data.get("quickmap"), list)):
        problem("validation.json", "needs pgda69 (list), horizons (object) and quickmap (list)")
    stats = data.get("pgda69Stats", [])
    if data.get("pgda69") and not (stats and stats[-1].get("region") == "ALL"):
        problem("validation.json", "pgda69 rows need pgda69Stats ending with region ALL")
    for entry in stats:
        for body in ("sun", "earth"):
            for key in ("halfDisk", "anyPart", "meanDisk"):
                if set(entry.get(body, {}).get(key, {})) != {"n", "meanOurs", "meanPgda", "meanDifference", "rmse", "pearsonR"}:
                    problem("validation.json", f"pgda69Stats {entry.get('region')} {body} {key}: wrong fields")


def check_maps(data, maps_folder):
    seen = set()
    for entry in data["maps"]:
        map_id, kind, image, bounds = entry.get("id"), entry.get("kind"), str(entry.get("image")), entry.get("boundsM")
        if map_id != "south_pole" and map_id not in REGION_CODES:
            problem("maps.json", f"{map_id}: id must be south_pole or a region code")
        if kind not in MAP_KINDS:
            problem("maps.json", f"{map_id}: unknown kind {kind}")
        if (map_id, kind) in seen:
            problem("maps.json", f"{map_id}: duplicate {kind}")
        seen.add((map_id, kind))
        path = maps_folder / image.removeprefix("/maps/")
        if not image.startswith("/maps/"):
            problem("maps.json", f"{image}: image must start with /maps/")
        elif not path.is_file():
            problem("maps.json", f"{image}: missing")
        elif path.stat().st_size > MAX_IMAGE_BYTES:
            problem("maps.json", f"{image}: {path.stat().st_size / 1e6:.1f} MB, limit is 1 MB")
        if not (isinstance(bounds, list) and len(bounds) == 4 and all(is_number(v) for v in bounds)
                and bounds[0] < bounds[2] and bounds[1] < bounds[3]):
            problem("maps.json", f"{map_id} {kind}: boundsM must be 4 numbers [xMin, yMin, xMax, yMax] with min < max")


def check_terrain(data, terrain_folder, region_bounds):
    """D10: every region has a .bin of width × height Int16 samples whose bounds contain the region."""
    for entry in data["regions"]:
        code, width, height, bounds = entry.get("code"), entry.get("width"), entry.get("height"), entry.get("boundsM")
        path = terrain_folder / str(entry.get("file")).removeprefix("/terrain/")
        if not path.is_file():
            problem("terrain/index.json", f"{code}: {entry.get('file')} missing")
        elif path.stat().st_size != width * height * 2:
            problem("terrain/index.json", f"{code}: expected {width * height * 2} bytes, file has {path.stat().st_size}")
        elif path.stat().st_size > MAX_TERRAIN_BYTES:
            problem("terrain/index.json", f"{code}: over 300 KB")
        region = region_bounds.get(code)
        if region is None or not (bounds[0] <= region[0] and bounds[1] <= region[1] and bounds[2] >= region[2] and bounds[3] >= region[3]):
            problem("terrain/index.json", f"{code}: bounds do not contain the region")
    missing = set(region_bounds) - {entry.get("code") for entry in data["regions"]}
    if missing:
        problem("terrain/index.json", f"no terrain for {sorted(missing)}")


CAP_ID = re.compile(r"^CAP-r\d{3}c\d{3}$")


def check_cap(folder):
    """Whole-cap 2 km grid (README D9): <folder>/cap/index.json plus its tile files."""
    cap_folder = Path(folder) / "cap"
    index = load(cap_folder, "index.json", False)
    if index is None:
        return
    regions = json.loads((Path(folder) / "regions.json").read_text(encoding="utf-8"))["regions"]
    region_bounds = [region["boundsM"] for region in regions]
    seen_ids, total, feasible_total = set(), 0, 0
    for tile in index.get("tiles", []):
        name = f"cap/{tile['id']}.json"
        data = load(cap_folder, f"{tile['id']}.json", False)
        if data is None:
            continue
        x_min, y_min, x_max, y_max = tile["boundsM"]
        cells = data.get("cells", [])
        feasible_count = sum(cell.get("feasible") is True for cell in cells)
        if data.get("tileId") != tile["id"]:
            problem(name, "tileId must equal the tile id in index.json")
        if (len(cells), feasible_count) != (tile["cellCount"], tile["feasibleCount"]):
            problem(name, "index cellCount/feasibleCount do not match the tile contents")
        total, feasible_total = total + len(cells), feasible_total + feasible_count
        for cell in cells:
            if check_cell(name, "CAP", cell) is None:
                continue
            if not CAP_ID.match(cell["id"]) or cell["id"] in seen_ids:
                problem(name, f"{cell['id']}: id must match CAP-r###c### and be unique")
            seen_ids.add(cell["id"])
            if not (x_min <= cell["xM"] < x_max and y_min <= cell["yM"] < y_max):
                problem(name, f"{cell['id']}: centre outside its tile bounds")
            if any(b[0] <= cell["xM"] <= b[2] and b[1] <= cell["yM"] <= b[3] for b in region_bounds):
                problem(name, f"{cell['id']}: centre inside a region's boundsM")
    if (total, feasible_total) != (index.get("cellCount"), index.get("feasibleCount")):
        problem("cap/index.json", f"cellCount/feasibleCount {index.get('cellCount')}/{index.get('feasibleCount')} but tiles hold {total}/{feasible_total}")


def run_check(file_name, check, *arguments):
    """Malformed input becomes a listed problem instead of a traceback, so the other files are still checked."""
    try:
        check(*arguments)
    except (TypeError, AttributeError, KeyError, ValueError) as error:
        problem(file_name, f"malformed ({type(error).__name__}: {error})")


def main():
    folder = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else WEB_DATA_FOLDER
    expect_mock = folder.name == "mock"
    for file_name, check, required in [("ephemeris.json", check_ephemeris, True), ("sites.json", check_sites, True),
                                       ("validation.json", check_validation, expect_mock)]:
        data = load(folder, file_name, expect_mock, required)
        if data is not None:
            run_check(file_name, check, data, expect_mock)
    regions = load(folder, "regions.json", expect_mock)
    if regions is not None:
        run_check("regions.json", check_regions, regions, folder, expect_mock)
    if not expect_mock:  # mock mode has no map images
        maps = load(folder.parent / "maps", "maps.json", False, required=False)
        if maps is not None:
            run_check("maps.json", check_maps, maps, folder.parent / "maps")
        terrain = load(folder.parent / "terrain", "index.json", False, required=False)
        if terrain is not None and regions is not None:
            run_check("terrain/index.json", check_terrain, terrain, folder.parent / "terrain",
                      {region["code"]: region["boundsM"] for region in regions["regions"]})
    for path in sorted(folder.glob("*.json")):  # files nothing references still obey size and mock rules
        if path.name not in loaded_files:
            load(folder, path.name, expect_mock)
    if not expect_mock and (folder / "cap" / "index.json").exists():  # mock data has no cap grid
        run_check("cap", check_cap, folder)
    print(f"checked {folder}")
    for line in problems:
        print("  problem:", line)
    if problems:
        raise SystemExit(f"{len(problems)} problem(s)")
    print("  OK, follows the README data contract")


if __name__ == "__main__":
    main()
