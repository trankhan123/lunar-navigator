"""Shared paths, constants and helpers for every pipeline module (contract: README "Data files")."""
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_FOLDER = PROJECT_ROOT / "pipeline" / "raw"
OUT_FOLDER = PROJECT_ROOT / "pipeline" / "out"  # intermediate results, committed so other members can build without raw data
WEB_DATA_FOLDER = PROJECT_ROOT / "web" / "public" / "data"
SITES_FILE = PROJECT_ROOT / "pipeline" / "sites.json"

MOON_RADIUS_M = 1737400.0
# CRS of every PGDA raster used here: south polar stereographic on the 1737.4 km sphere, metres.
PGDA_CRS = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
MOON_LONLAT_CRS = "+proj=longlat +R=1737400 +no_defs"
MAST_HEIGHT_M = 2.0
SLOPE_LIMIT_DEG = 20.0
PSR_LIMIT_FRACTION = 0.5
EPHEMERIS_START = "2027-01-01"
EPHEMERIS_STOP = "2029-01-31"
REGION_CODES = ["CAB", "HAW", "MAL", "MMP", "MMO", "NR1", "NR2", "DGR", "SLP"]


def load_sites():
    """Sites from pipeline/sites.json with coordinates; prints a warning for each TODO site it skips."""
    sites = json.loads(SITES_FILE.read_text(encoding="utf-8"))["sites"]
    usable = []
    for site in sites:
        if site["lat"] is None or site["lon"] is None:
            print(f"warning: skip {site['id']} (no coordinates yet, source {site['source']})")
        else:
            usable.append(site)
    return usable


def artemis_regions():
    return [site for site in load_sites() if site.get("region")]


def write_json(path, data):
    """Compact JSON (no spaces) so web files stay small."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"wrote  {path.relative_to(PROJECT_ROOT)} ({path.stat().st_size / 1e6:.2f} MB)")
