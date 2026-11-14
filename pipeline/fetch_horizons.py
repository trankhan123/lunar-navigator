"""D1 — Ephemeris: JPL Horizons → web/public/data/ephemeris.json and the vector-check fixture.

Contract: README "D1 Ephemeris" and "ephemeris.json". Run: python pipeline/fetch_horizons.py
Input:  Horizons API (cache raw text in pipeline/raw/horizons/, never call twice for the same range)
Output: web/public/data/ephemeris.json
        web/src/core/fixtures/horizons_check.json (read by web/src/core/geometry.test.js)
"""
from common import EPHEMERIS_START, EPHEMERIS_STOP, RAW_FOLDER

HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
CACHE_FOLDER = RAW_FOLDER / "horizons"


def fetch_ephemeris_text(start, stop):
    """One call per quarter: COMMAND='301', CENTER='500@399', QUANTITIES='14,15,19,20', STEP_SIZE='1h',
    CSV_FORMAT='YES'. Cache to CACHE_FOLDER / f"ephemeris_{start}_{stop}.txt" and return the text."""
    raise NotImplementedError("D1 fetch_ephemeris_text")


def parse_ephemeris(text):
    """Rows between $$SOE and $$EOE → list of dicts:
    time 'YYYY-MM-DDTHH:mmZ', sunSubLonDeg, sunSubLatDeg, sunDistanceAu, earthSubLonDeg, earthSubLatDeg, earthDistanceKm.
    Read the header for column names and units; longitudes must end up East-positive in −180..180."""
    raise NotImplementedError("D1 parse_ephemeris")


def write_ephemeris_json(rows):
    """Columnar ephemeris.json (README "ephemeris.json"): degrees rounded to 2 decimals, km to 0, AU to 5."""
    raise NotImplementedError("D1 write_ephemeris_json")


def fetch_topocentric(lat, lon, height_km, body_command, times):
    """Horizons COMMAND=10 (Sun) or 399 (Earth), CENTER='coord@301', SITE_COORD=f'{lon},{lat},{height_km}',
    QUANTITIES='4' → list of (time, azimuthDeg, elevationDeg) at the given ISO times."""
    raise NotImplementedError("D1 fetch_topocentric")


def write_horizons_fixture():
    """2 cells × Sun/Earth × 5 times → fixture points {lat, lon, heightM, body, time, azimuthDeg, elevationDeg,
    subLonDeg, subLatDeg, distanceKm}; the sub-point values come from ephemeris.json at the same hour."""
    raise NotImplementedError("D1 write_horizons_fixture")


if __name__ == "__main__":
    print(f"range {EPHEMERIS_START} → {EPHEMERIS_STOP}")
    raise SystemExit("Not implemented yet: D1 fetch_horizons.py")
