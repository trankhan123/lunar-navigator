"""D1 — Ephemeris: JPL Horizons → web/public/data/ephemeris.json and the vector-check fixture.

Contract: README "D1 Ephemeris" and "ephemeris.json". Run: python pipeline/fetch_horizons.py
Input:  Horizons API (raw text cached in pipeline/raw/horizons/, so each range is fetched once)
Output: web/public/data/ephemeris.json
        web/src/core/fixtures/horizons_check.json (read by web/src/core/geometry.test.js)
"""
from datetime import datetime, timedelta

import requests

from common import EPHEMERIS_START, EPHEMERIS_STOP, PROJECT_ROOT, RAW_FOLDER, WEB_DATA_FOLDER, load_sites, write_json

HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
CACHE_FOLDER = RAW_FOLDER / "horizons"
FIXTURE_FILE = PROJECT_ROOT / "web" / "src" / "core" / "fixtures" / "horizons_check.json"
AU_KM = 149597870.7
TIME_FORMAT = "%Y-%m-%dT%H:%MZ"
# Vector-method check points (site ids in pipeline/sites.json) and times (whole hours inside the ephemeris).
CHECK_SITE_IDS = ["malapert-massif", "haworth", "apollo-11"]
CHECK_TIMES = ["2027-02-10T06:00Z", "2027-09-01T00:00Z", "2028-01-01T00:00Z", "2028-05-20T18:00Z", "2028-11-05T03:00Z"]
BODY_COMMANDS = {"sun": "10", "earth": "399"}


def call_horizons(cache_name, parameters):
    """GET the Horizons API in text format, cached by file name. Returns the raw text."""
    cache_path = CACHE_FOLDER / cache_name
    if cache_path.exists():
        return cache_path.read_text(encoding="utf-8")
    query = {"format": "text", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'OBSERVER'", "CSV_FORMAT": "'YES'"}
    query |= {key: f"'{value}'" for key, value in parameters.items()}
    response = requests.get(HORIZONS_URL, params=query, timeout=120)
    response.raise_for_status()
    text = response.text
    if "$$SOE" not in text or "$$EOE" not in text:
        raise RuntimeError(f"Horizons returned no complete ephemeris for {cache_name}:\n{text[:1500]}")
    CACHE_FOLDER.mkdir(parents=True, exist_ok=True)
    partial_path = cache_path.with_suffix(".part")  # never leave a half-written cache that later runs would trust
    partial_path.write_text(text, encoding="utf-8")
    partial_path.replace(cache_path)
    return text


def read_table(text):
    """CSV rows between $$SOE and $$EOE as dicts keyed by the header names (e.g. 'ObsSub-LON')."""
    lines = text.splitlines()
    start = lines.index("$$SOE")
    header = [name.strip() for name in lines[start - 2].split(",")]
    rows = []
    for line in lines[start + 1 : lines.index("$$EOE")]:
        cells = [cell.strip() for cell in line.split(",")]
        rows.append(dict(zip(header, cells)))
    return rows


def parse_time(horizons_time):
    return datetime.strptime(horizons_time, "%Y-%b-%d %H:%M")


def east_longitude(degrees_0_to_360):
    return (degrees_0_to_360 + 180) % 360 - 180


def quarter_ranges(start, stop):
    """(start, stop) pairs of at most 3 months, stop = last hour inside the range."""
    current = datetime.fromisoformat(start)
    last_hour = datetime.fromisoformat(stop) + timedelta(hours=23)
    ranges = []
    while current <= last_hour:
        month = current.month + 3
        next_start = current.replace(year=current.year + (month - 1) // 12, month=(month - 1) % 12 + 1)
        ranges.append((current, min(next_start - timedelta(hours=1), last_hour)))
        current = next_start
    return ranges


def fetch_ephemeris_text(start, stop):
    """One call: Moon seen from the Earth centre, sub-Earth point (14), sub-solar point (15), ranges (19, 20) in km."""
    name = f"ephemeris_{start:%Y-%m-%dT%H}_{stop:%Y-%m-%dT%H}.txt"
    return call_horizons(name, {
        "COMMAND": "301", "CENTER": "500@399", "QUANTITIES": "14,15,19,20", "RANGE_UNITS": "KM",
        "START_TIME": f"{start:%Y-%m-%d %H:%M}", "STOP_TIME": f"{stop:%Y-%m-%d %H:%M}", "STEP_SIZE": "1h",
    })


def parse_ephemeris(text):
    """Horizons rows → dicts in contract units. ObsSub/SunSub longitudes are East-positive 0..360 (MOON_ME frame)."""
    if "Target pole/equ : MOON_ME" not in text or "East-longitude positive" not in text:
        raise RuntimeError("Unexpected frame or longitude convention in the Horizons header")
    if "Units: KM and KM/S" not in text:
        raise RuntimeError("Horizons ranges are not in km (RANGE_UNITS='KM' missing?)")
    return [{
        "time": parse_time(row["Date__(UT)__HR:MN"]),
        "sunSubLonDeg": east_longitude(float(row["SunSub-LON"])),
        "sunSubLatDeg": float(row["SunSub-LAT"]),
        "sunDistanceAu": float(row["r"]) / AU_KM,
        "earthSubLonDeg": east_longitude(float(row["ObsSub-LON"])),
        "earthSubLatDeg": float(row["ObsSub-LAT"]),
        "earthDistanceKm": float(row["delta"]),
    } for row in read_table(text)]


def write_ephemeris_json(rows, retrieved, path=WEB_DATA_FOLDER / "ephemeris.json"):
    """Columnar ephemeris.json: degrees rounded to 2 decimals, km to 0, AU to 5. Rows must be consecutive hours."""
    for previous, current in zip(rows, rows[1:]):
        if current["time"] - previous["time"] != timedelta(hours=1):
            raise RuntimeError(f"Gap or duplicate in ephemeris at {current['time']}")
    column = lambda key, digits: [round(row[key], digits) for row in rows]
    write_json(path, {
        "source": "JPL Horizons API (DE441): COMMAND=301 CENTER=500@399 QUANTITIES=14,15,19,20, MOON_ME frame, "
                  f"retrieved {retrieved:%Y-%m-%d}",
        "startTime": rows[0]["time"].strftime(TIME_FORMAT),
        "stepHours": 1,
        "hours": len(rows),
        "sunSubLonDeg": column("sunSubLonDeg", 2),
        "sunSubLatDeg": column("sunSubLatDeg", 2),
        "sunDistanceAu": column("sunDistanceAu", 5),
        "earthSubLonDeg": column("earthSubLonDeg", 2),
        "earthSubLatDeg": column("earthSubLatDeg", 2),
        "earthDistanceKm": [round(row["earthDistanceKm"]) for row in rows],
    })


def fetch_topocentric(name, lat, lon, height_km, body, time):
    """Apparent azimuth/elevation of the Sun or Earth seen from a point on the Moon at one time."""
    hour = datetime.strptime(time, TIME_FORMAT)
    text = call_horizons(f"topo_{name}_{lat}_{lon}_{body}_{hour:%Y-%m-%dT%H}.txt", {
        "COMMAND": BODY_COMMANDS[body], "CENTER": "coord@301", "COORD_TYPE": "GEODETIC",
        "SITE_COORD": f"{lon},{lat},{height_km}", "QUANTITIES": "4",
        "START_TIME": f"{hour:%Y-%m-%d %H:%M}", "STOP_TIME": f"{hour + timedelta(hours=1):%Y-%m-%d %H:%M}", "STEP_SIZE": "1h",
    })
    row = read_table(text)[0]
    azimuth = next(value for key, value in row.items() if key.startswith("Azi"))
    elevation = next(value for key, value in row.items() if key.startswith("Elev"))
    return float(azimuth), float(elevation)


def write_horizons_fixture(rows):
    """CHECK_POINTS × Sun/Earth × CHECK_TIMES, with the sub-point values from the (rounded) ephemeris at the same hour."""
    by_time = {row["time"].strftime(TIME_FORMAT): row for row in rows}
    sites = {site["id"]: site for site in load_sites()}
    points = []
    for name in CHECK_SITE_IDS:
        lat, lon = sites[name]["lat"], sites[name]["lon"]
        for body in BODY_COMMANDS:
            for time in CHECK_TIMES:
                azimuth, elevation = fetch_topocentric(name, lat, lon, 0, body, time)
                row = by_time[time]
                distance_km = row["sunDistanceAu"] * AU_KM if body == "sun" else row["earthDistanceKm"]
                points.append({
                    "lat": lat, "lon": lon, "heightM": 0, "body": body, "time": time,
                    "azimuthDeg": azimuth, "elevationDeg": elevation,
                    "subLonDeg": round(row[f"{body}SubLonDeg"], 2), "subLatDeg": round(row[f"{body}SubLatDeg"], 2),
                    "distanceKm": round(distance_km),
                })
    write_json(FIXTURE_FILE, {"source": "JPL Horizons API: COMMAND=10/399 CENTER=coord@301 QUANTITIES=4 (apparent az/el)", "points": points})


def main():
    rows = []
    for start, stop in quarter_ranges(EPHEMERIS_START, EPHEMERIS_STOP):
        quarter_rows = parse_ephemeris(fetch_ephemeris_text(start, stop))
        if (quarter_rows[0]["time"], quarter_rows[-1]["time"]) != (start, stop):
            raise RuntimeError(f"Horizons returned {quarter_rows[0]['time']} … {quarter_rows[-1]['time']}, asked {start} … {stop}")
        print(f"rows   {start:%Y-%m-%d} → {stop:%Y-%m-%d %H:%M}: {len(quarter_rows)}")
        rows += quarter_rows
    retrieved = datetime.fromtimestamp(min(path.stat().st_mtime for path in CACHE_FOLDER.glob("ephemeris_*.txt")))
    write_ephemeris_json(rows, retrieved)
    write_horizons_fixture(rows)


if __name__ == "__main__":
    main()
