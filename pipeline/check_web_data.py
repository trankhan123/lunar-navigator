"""Check that a data folder follows the README data contract. Real and mock data must both pass.

Run: python pipeline/check_web_data.py                       (web/public/data)
     python pipeline/check_web_data.py web/public/data/mock  (mock data: every file must say "mock": true)
Exit code 1 and a list of problems when something is wrong.
"""
import json
import re
import sys
from pathlib import Path

from common import REGION_CODES, WEB_DATA_FOLDER

MAX_FILE_BYTES = 2_000_000
ISO_HOUR = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:00Z$")
EPHEMERIS_ARRAYS = ["sunSubLonDeg", "sunSubLatDeg", "sunDistanceAu", "earthSubLonDeg", "earthSubLatDeg", "earthDistanceKm"]
CELL_KEYS = ["id", "label", "lat", "lon", "xM", "yM", "heightM", "slopeDeg", "psrFraction", "feasible", "infeasibleReason", "horizon"]
SITE_GROUPS = {"artemis-region", "apollo", "clps", "international"}
problems = []


def problem(file_name, message):
    problems.append(f"{file_name}: {message}")


def load(folder, file_name, expect_mock):
    path = folder / file_name
    if not path.exists():
        problem(file_name, "missing")
        return None
    if path.stat().st_size > MAX_FILE_BYTES:
        problem(file_name, f"{path.stat().st_size / 1e6:.1f} MB, limit is 2 MB")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        problem(file_name, "top level must be an object")
        return None
    if bool(data.get("mock")) != expect_mock:
        problem(file_name, f'"mock" must be {str(expect_mock).lower()} in this folder')
    return data


def in_range(value, low, high):
    return isinstance(value, (int, float)) and low <= value <= high


def check_horizon(file_name, owner, horizon):
    if horizon is None:
        return
    if not (isinstance(horizon, list) and len(horizon) == 360 and all(isinstance(v, int) and -900 <= v <= 900 for v in horizon)):
        problem(file_name, f"{owner}: horizon must be null or 360 integers in 0.1° units")


def check_ephemeris(data):
    name = "ephemeris.json"
    if not ISO_HOUR.match(str(data.get("startTime"))):
        problem(name, "startTime must look like 2027-01-01T00:00Z")
    if data.get("stepHours") != 1:
        problem(name, "stepHours must be 1")
    hours = data.get("hours")
    for key in EPHEMERIS_ARRAYS:
        values = data.get(key)
        if not isinstance(values, list) or len(values) != hours:
            problem(name, f"{key} must be a list of length hours ({hours})")
            continue
        low, high = {"Lon": (-180, 180), "Lat": (-90, 90), "Au": (0.9, 1.1), "Km": (3.4e5, 4.1e5)}[re.search("Lon|Lat|Au|Km", key)[0]]
        if not all(in_range(v, low, high) for v in values):
            problem(name, f"{key} has values outside {low}..{high}")


def check_cells(data, file_name, code):
    limit_slope, limit_psr = data.get("slopeLimitDeg"), data.get("psrLimitFraction")
    if data.get("region") != code:
        problem(file_name, f'region must be "{code}"')
    if data.get("horizonUnitDeg") != 0.1:
        problem(file_name, "horizonUnitDeg must be 0.1")
    cells = data.get("cells") or []
    if not cells:
        problem(file_name, "cells is empty")
    seen = set()
    for cell in cells:
        cell_id = cell.get("id", "?")
        if sorted(cell) != sorted(CELL_KEYS):
            problem(file_name, f"{cell_id}: keys must be exactly {CELL_KEYS}")
            continue
        if cell_id in seen or not cell_id.startswith(f"{code}-") or cell_id != f"{code}-{cell['label']}":
            problem(file_name, f"{cell_id}: id must be unique and equal '{code}-' + label")
        seen.add(cell_id)
        if not (in_range(cell["lat"], -90, -60) and in_range(cell["lon"], -180, 180)):
            problem(file_name, f"{cell_id}: lat/lon out of range")
        expected = cell["slopeDeg"] <= limit_slope and cell["psrFraction"] <= limit_psr
        reason = None if expected else ("slope" if cell["slopeDeg"] > limit_slope else "psr")
        if cell["feasible"] is not expected or cell["infeasibleReason"] != reason:
            problem(file_name, f"{cell_id}: feasible/infeasibleReason do not match slope and PSR limits")
        check_horizon(file_name, cell_id, cell["horizon"])
        if cell["horizon"] is None:
            problem(file_name, f"{cell_id}: grid cells must have a horizon")
    return len(cells), sum(cell.get("feasible") is True for cell in cells)


def check_regions(data, folder, expect_mock):
    for region in data.get("regions") or problem("regions.json", "regions is empty") or []:
        code = region.get("code")
        if code not in REGION_CODES:
            problem("regions.json", f"unknown region code {code}")
            continue
        if not (isinstance(region.get("boundsM"), list) and len(region["boundsM"]) == 4):
            problem("regions.json", f"{code}: boundsM must be [xMin, yMin, xMax, yMax]")
        if region.get("cellsFile") != f"cells_{code}.json":
            problem("regions.json", f"{code}: cellsFile must be cells_{code}.json")
            continue
        cells = load(folder, region["cellsFile"], expect_mock)
        if cells is not None:
            counts = check_cells(cells, region["cellsFile"], code)
            if counts != (region.get("cellCount"), region.get("feasibleCount")):
                problem("regions.json", f"{code}: cellCount/feasibleCount {region.get('cellCount')}/{region.get('feasibleCount')} but file has {counts}")


def check_sites(data):
    seen = set()
    for site in data.get("sites") or problem("sites.json", "sites is empty") or []:
        site_id = site.get("id", "?")
        if site_id in seen or site.get("group") not in SITE_GROUPS:
            problem("sites.json", f"{site_id}: duplicate id or unknown group")
        seen.add(site_id)
        if not (in_range(site.get("lat"), -90, 90) and in_range(site.get("lon"), -180, 180)):
            problem("sites.json", f"{site_id}: lat/lon missing or out of range (TODO sites must not be published)")
        if site.get("region") is not None and site["region"] not in REGION_CODES:
            problem("sites.json", f"{site_id}: unknown region")
        if site.get("hasTerrain") is not (site.get("horizon") is not None):
            problem("sites.json", f"{site_id}: hasTerrain must be true exactly when horizon is given")
        check_horizon("sites.json", site_id, site.get("horizon"))


def main():
    folder = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else WEB_DATA_FOLDER
    expect_mock = folder.name == "mock"
    for file_name, check in [("ephemeris.json", check_ephemeris), ("sites.json", check_sites)]:
        data = load(folder, file_name, expect_mock)
        if data is not None:
            check(data)
    regions = load(folder, "regions.json", expect_mock)
    if regions is not None:
        check_regions(regions, folder, expect_mock)
    print(f"checked {folder}")
    for line in problems:
        print("  problem:", line)
    if problems:
        raise SystemExit(f"{len(problems)} problem(s)")
    print("  OK, follows the README data contract")


if __name__ == "__main__":
    main()
