"""D1 — Call Home (Task 11): DSN Ground Stations Apparent Elevation.

Fetches apparent elevation of the Moon (COMMAND='301') seen from 3 Deep Space Network (DSN)
ground stations on Earth (CENTER='coord@399'):
  - Goldstone (DSS-14): lat 35.4259, lon -116.8895, alt 1.001 km
  - Madrid (DSS-63):    lat 40.4314, lon -4.2480,   alt 0.834 km
  - Canberra (DSS-43):  lat -35.4014, lon 148.9813, alt 0.689 km

Source: NASA/JPL DSN Telecommunications Link Design Handbook 810-005, module 301 "Coverage and
Geometry", Rev. K (2016), https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301K.pdf
  - Table 5 (WGS 84 geodetic coordinates) agrees with the numbers above to 0.001 deg (about 100 m, far
    below what matters for Moon elevation), except heights: DSS-63 is 0.865 km in the table, the code has 0.834 km
    (DSS-65's value); DSS-43 latitude is -35.4024 in the table. The numbers were deliberately left unchanged.
  - The 10 deg mask: sec. 2.2.1 and 2.2.4 give 10.0 deg as the absolute lower elevation limit of the DSN antennas
    (transmit; the handbook gives no separate receive minimum), raised where terrain requires it.
    Per-station horizon masks (Figures 11, 19, 23) are not used here.

Contract:
  Time range matches ephemeris.json: 2027-01-01T00:00Z to 2029-01-31T23:00Z, step 1h (18288 hours).
  Raw responses cached in: pipeline/raw/horizons_dsn/ (gitignored).
  Output:
    - web/public/data/dsn.json (elevation * 10 rounded to int, unit 0.1 deg)
    - web/public/data/mock/dsn.json ("mock": true, matching hours with mock/ephemeris.json)

Run: python pipeline/fetch_dsn.py
"""
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import EPHEMERIS_START, EPHEMERIS_STOP, PROJECT_ROOT, RAW_FOLDER, WEB_DATA_FOLDER, write_json

HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
CACHE_FOLDER = RAW_FOLDER / "horizons_dsn"
MOCK_DATA_FOLDER = WEB_DATA_FOLDER / "mock"
TIME_FORMAT = "%Y-%m-%dT%H:%MZ"

STATIONS = {
    "goldstone": {
        "name": "Goldstone (DSS-14)",
        "code": "DSS-14",
        "lat": 35.4259,
        "lon": -116.8895,
        "heightKm": 1.001,
    },
    "madrid": {
        "name": "Madrid (DSS-63)",
        "code": "DSS-63",
        "lat": 40.4314,
        "lon": -4.2480,
        "heightKm": 0.834,
    },
    "canberra": {
        "name": "Canberra (DSS-43)",
        "code": "DSS-43",
        "lat": -35.4014,
        "lon": 148.9813,
        "heightKm": 0.689,
    },
}


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
    if "$$SOE" not in text:
        raise RuntimeError(f"Horizons returned no ephemeris for {cache_name}:\n{text[:1500]}")
    CACHE_FOLDER.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(text, encoding="utf-8")
    return text


def read_table(text):
    """CSV rows between $$SOE and $$EOE as dicts keyed by header names."""
    lines = text.splitlines()
    start = next(i for i, line in enumerate(lines) if line.strip() == "$$SOE")
    end = next(i for i, line in enumerate(lines) if line.strip() == "$$EOE")
    header = [name.strip() for name in lines[start - 2].split(",")]
    rows = []
    for line in lines[start + 1 : end]:
        cells = [cell.strip() for cell in line.split(",")]
        rows.append(dict(zip(header, cells)))
    return rows


def parse_time(horizons_time):
    return datetime.strptime(horizons_time, "%Y-%b-%d %H:%M")


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


def fetch_station_quarter(station_id, station_cfg, start, stop):
    """Fetch one quarter range for one ground station."""
    cache_name = f"dsn_{station_id}_{start:%Y-%m-%dT%H}_{stop:%Y-%m-%dT%H}.txt"
    site_coord = f"{station_cfg['lon']},{station_cfg['lat']},{station_cfg['heightKm']}"
    return call_horizons(cache_name, {
        "COMMAND": "301",
        "CENTER": "coord@399",
        "COORD_TYPE": "GEODETIC",
        "SITE_COORD": site_coord,
        "QUANTITIES": "4",
        "START_TIME": f"{start:%Y-%m-%d %H:%M}",
        "STOP_TIME": f"{stop:%Y-%m-%d %H:%M}",
        "STEP_SIZE": "1h",
    })


def parse_station_text(text):
    """Parse Horizons rows into a list of dicts with time and elevation in 0.1 deg integer."""
    rows = []
    for row in read_table(text):
        time = parse_time(row["Date__(UT)__HR:MN"])
        elev_str = next(v for k, v in row.items() if k.startswith("Elev"))
        elevation_deg = float(elev_str)
        # Unit 0.1 deg: elevation multiplied by 10 then rounded to integer
        elevation_int = round(elevation_deg * 10)
        rows.append({"time": time, "elevation": elevation_int})
    return rows


def fetch_all_for_station(station_id, station_cfg, ranges):
    """Fetch and concatenate all hours for a station, verifying hourly continuity."""
    all_rows = []
    for start, stop in ranges:
        raw_text = fetch_station_quarter(station_id, station_cfg, start, stop)
        q_rows = parse_station_text(raw_text)
        all_rows.extend(q_rows)

    # Verify hourly continuity
    for prev_row, cur_row in zip(all_rows, all_rows[1:]):
        if cur_row["time"] - prev_row["time"] != timedelta(hours=1):
            raise RuntimeError(f"Gap or duplicate in {station_id} ephemeris at {cur_row['time']}")

    return all_rows


def build_dsn_data(stations_data, start_time_str, hours):
    """Construct the dictionary for dsn.json."""
    return {
        "source": "JPL Horizons API (DE441): COMMAND=301 CENTER=coord@399 QUANTITIES=4, "
                  f"retrieved {datetime.now():%Y-%m-%d}",
        "startTime": start_time_str,
        "stepHours": 1,
        "hours": hours,
        "elevationUnitDeg": 0.1,
        "stations": {
            sid: {
                "name": cfg["name"],
                "code": cfg["code"],
                "lat": cfg["lat"],
                "lon": cfg["lon"],
                "heightKm": cfg["heightKm"],
            }
            for sid, cfg in STATIONS.items()
        },
        "goldstone": stations_data["goldstone"],
        "madrid": stations_data["madrid"],
        "canberra": stations_data["canberra"],
    }


def main():
    ranges = quarter_ranges(EPHEMERIS_START, EPHEMERIS_STOP)
    stations_elev = {}
    sample_rows = None

    for station_id, station_cfg in STATIONS.items():
        print(f"Fetching DSN elevation for {station_cfg['name']}...")
        rows = fetch_all_for_station(station_id, station_cfg, ranges)
        print(f"  {station_id}: {len(rows)} hours loaded")
        stations_elev[station_id] = [r["elevation"] for r in rows]
        if sample_rows is None:
            sample_rows = rows

    total_hours = len(sample_rows)
    start_time_str = sample_rows[0]["time"].strftime(TIME_FORMAT)
    print(f"Total ephemeris hours: {total_hours} (start: {start_time_str})")

    # 1. Real dsn.json
    real_dsn = build_dsn_data(stations_elev, start_time_str, total_hours)
    real_path = WEB_DATA_FOLDER / "dsn.json"
    write_json(real_path, real_dsn)

    # 2. Mock dsn.json
    mock_ephem_path = MOCK_DATA_FOLDER / "ephemeris.json"
    if mock_ephem_path.exists():
        mock_ephem = json.loads(mock_ephem_path.read_text(encoding="utf-8"))
        mock_start = mock_ephem["startTime"]
        mock_hours = mock_ephem["hours"]
    else:
        mock_start = "2028-01-01T00:00Z"
        mock_hours = 5112

    # Find offset in real rows corresponding to mock_start
    mock_start_dt = datetime.strptime(mock_start, TIME_FORMAT)
    real_start_dt = sample_rows[0]["time"]
    start_offset = int((mock_start_dt - real_start_dt).total_seconds() // 3600)
    end_offset = start_offset + mock_hours

    if start_offset < 0 or end_offset > total_hours:
        raise RuntimeError(f"Mock time range {mock_start} (+{mock_hours}h) outside real ephemeris range")

    mock_stations_elev = {
        sid: elev[start_offset:end_offset]
        for sid, elev in stations_elev.items()
    }

    mock_dsn = build_dsn_data(mock_stations_elev, mock_start, mock_hours)
    mock_dsn["mock"] = True
    mock_dsn["source"] = "JPL Horizons API (DE441): COMMAND=301 CENTER=coord@399 QUANTITIES=4 (mock subset)"

    mock_path = MOCK_DATA_FOLDER / "dsn.json"
    write_json(mock_path, mock_dsn)


if __name__ == "__main__":
    main()
