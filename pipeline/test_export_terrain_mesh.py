"""Tests for D10 — pipeline/export_terrain_mesh.py and check_terrain. Synthetic arrays, not real data.

Run: python -m pytest pipeline/test_export_terrain_mesh.py
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_web_data as checker  # noqa: E402
from export_terrain_mesh import remove_curvature, window_size  # noqa: E402


def test_window_size_keeps_aspect_and_caps_the_long_side():
    assert window_size([0, 0, 40000, 20000]) == (320, 160)
    assert window_size([0, 0, 10000, 30000]) == (107, 320)


def test_remove_curvature_lowers_edges_by_d_squared_over_2r():
    flat = remove_curvature(np.zeros((3, 3)), [-30000, -30000, 30000, 30000])
    assert flat[1, 1] == 0  # centre sample
    assert abs(flat[0, 1] + 20000**2 / (2 * 1737400)) < 1e-6  # 20 km north of the centre: ~115 m lower
    assert flat[0, 0] < flat[0, 1]


def test_check_terrain_flags_wrong_size_missing_file_and_bounds(tmp_path):
    (tmp_path / "MAL.bin").write_bytes(bytes(10))
    entry = {"code": "MAL", "boundsM": [0, 0, 10, 10], "width": 4, "height": 4, "file": "/terrain/MAL.bin"}
    checker.problems.clear()
    checker.check_terrain({"regions": [entry, {**entry, "code": "HAW", "file": "/terrain/HAW.bin"}]},
                          tmp_path, {"MAL": [1, 1, 20, 9], "HAW": [1, 1, 5, 5]})
    assert any("MAL" in line and "expected 32 bytes" in line for line in checker.problems)
    assert any("HAW" in line and "missing" in line for line in checker.problems)
    assert any("MAL" in line and "bounds" in line for line in checker.problems)
