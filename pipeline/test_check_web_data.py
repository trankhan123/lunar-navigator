"""Tests for pipeline/check_web_data.py (maps.json). Synthetic entries, not real data.

Run: python -m pytest pipeline/test_check_web_data.py
"""
import json
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


def write_cap_folder(folder, cell_overrides=None, region_bounds=(5e5, 5e5, 6e5, 6e5)):
    """Synthetic cap folder: one tile with one cell at 85°S, 0°E, and one region box."""
    x, y = checker.TO_POLAR_XY.transform(0.0, -85.0)
    cell = {"id": "CAP-r000c000", "label": "r000c000", "lat": -85.0, "lon": 0.0, "xM": round(x, 1), "yM": round(y, 1),
            "heightM": 1.0, "slopeDeg": 5.0, "psrFraction": 0.0, "feasible": True, "infeasibleReason": None,
            "horizon": [0] * 360, **(cell_overrides or {})}
    (folder / "cap").mkdir()
    (folder / "regions.json").write_text(json.dumps({"regions": [{"boundsM": list(region_bounds)}]}))
    (folder / "cap" / "cap_0_3.json").write_text(json.dumps({"tileId": "cap_0_3", "cells": [cell]}))
    tile = {"id": "cap_0_3", "boundsM": [0, 120000, 40000, 160000], "cellCount": 1, "feasibleCount": 1}
    (folder / "cap" / "index.json").write_text(json.dumps({"cellCount": 1, "feasibleCount": 1, "tiles": [tile]}))


def test_check_cap_accepts_a_valid_folder(tmp_path):
    write_cap_folder(tmp_path)
    checker.problems.clear()
    checker.check_cap(tmp_path)
    assert checker.problems == []


def test_check_cap_flags_bad_id_short_horizon_and_cell_inside_a_region(tmp_path):
    write_cap_folder(tmp_path, {"id": "CAP-x", "label": "x", "horizon": [0] * 10}, region_bounds=(-1e6, -1e6, 1e6, 1e6))
    checker.problems.clear()
    checker.check_cap(tmp_path)
    assert any("horizon must be" in line for line in checker.problems)
    assert any("must match CAP-r###c###" in line for line in checker.problems)
