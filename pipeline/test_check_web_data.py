"""Tests for pipeline/check_web_data.py (maps.json). Synthetic entries, not real data.

Run: python -m pytest pipeline/test_check_web_data.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_web_data as checker  # noqa: E402


def test_check_maps_flags_unknown_kinds_duplicates_and_missing_images(tmp_path):
    (tmp_path / "MAL.png").write_bytes(b"\x89PNG")
    entry = {"id": "MAL", "kind": "hillshade", "image": "/maps/MAL.png", "boundsM": [0, 0, 1, 1], "metersPerPixel": 80}
    checker.problems.clear()
    checker.check_maps({"maps": [entry, entry, {**entry, "kind": "heat", "image": "/maps/MAL_heat.png"}]}, tmp_path)
    assert any("unknown kind heat" in line for line in checker.problems)
    assert any("duplicate hillshade" in line for line in checker.problems)
    assert any("/maps/MAL_heat.png: missing" in line for line in checker.problems)
    assert not any("/maps/MAL.png: missing" in line for line in checker.problems)


def test_check_validation_needs_stats_for_pgda69_rows():
    stat = {"n": 1, "meanOurs": 0, "meanPgda": 0, "meanDifference": 0, "rmse": 0, "pearsonR": 1}
    whole = {key: stat for key in ("halfDisk", "anyPart", "meanDisk")}
    base = {"horizons": {}, "quickmap": [], "pgda69": [{"cellId": "MAL-X"}]}
    checker.problems.clear()
    checker.check_validation(base, False)
    assert any("pgda69Stats" in line for line in checker.problems)
    checker.problems.clear()
    checker.check_validation({**base, "pgda69Stats": [{"region": "ALL", "sun": whole, "earth": whole}]}, False)
    assert not checker.problems
