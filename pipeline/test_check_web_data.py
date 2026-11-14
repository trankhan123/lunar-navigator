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


def test_check_relief_flags_missing_and_oversized_tiles(tmp_path):
    (tmp_path / "1").mkdir()
    (tmp_path / "1" / "0_0.jpg").write_bytes(b"x" * 10)
    (tmp_path / "1" / "1_0.jpg").write_bytes(b"x" * 300_001)
    level = {"z": 1, "tileSizeM": 304000, "metersPerPixel": 594, "contourIntervalM": 500, "tiles": ["0_0", "1_0", "0_1"]}
    index = {"tileSizePx": 512, "elevationLegend": [{"elevationM": 0, "color": "#000000"}], "levels": [level]}
    checker.problems.clear()
    checker.check_relief(index, tmp_path)
    assert len(checker.problems) == 2
    assert any("1/1_0.jpg" in line and "300 kB" in line for line in checker.problems)
    assert any("1/0_1.jpg: missing" in line for line in checker.problems)
