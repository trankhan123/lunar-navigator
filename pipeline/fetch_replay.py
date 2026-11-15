"""E6 — Mission Replay ephemerides: one short hourly Horizons ephemeris per replayed mission.

Reuses D1 (fetch_horizons). Run: python pipeline/fetch_replay.py
Input:  web/public/data/replay/index.json (landedUtc per mission)
Output: web/public/data/replay/<siteId>.json, same format as ephemeris.json, landing − 2 days … landing + 19 days
"""
import json
from datetime import datetime, timedelta

from common import WEB_DATA_FOLDER
from fetch_horizons import CACHE_FOLDER, TIME_FORMAT, fetch_ephemeris_text, parse_ephemeris, write_ephemeris_json

REPLAY_FOLDER = WEB_DATA_FOLDER / "replay"


def main():
    for mission in json.loads((REPLAY_FOLDER / "index.json").read_text(encoding="utf-8"))["missions"]:
        landing = datetime.strptime(mission["landedUtc"], TIME_FORMAT).replace(minute=0)
        start, stop = landing - timedelta(days=2), landing + timedelta(days=19)
        rows = parse_ephemeris(fetch_ephemeris_text(start, stop))
        if (rows[0]["time"], rows[-1]["time"]) != (start, stop):
            raise RuntimeError(f"Horizons returned {rows[0]['time']} … {rows[-1]['time']}, asked {start} … {stop}")
        retrieved = datetime.fromtimestamp(max(path.stat().st_mtime for path in CACHE_FOLDER.glob(f"ephemeris_{start:%Y-%m-%dT%H}_*.txt")))
        write_ephemeris_json(rows, retrieved, REPLAY_FOLDER / f"{mission['siteId']}.json")
        print(f"{mission['siteId']}: {len(rows)} rows from {start}")


if __name__ == "__main__":
    main()
