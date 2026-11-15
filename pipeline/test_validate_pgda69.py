"""Tests for the PGDA 69 comparison in validate.py. Synthetic numbers and a synthetic raster, not real data.

Run: python -m pytest pipeline/test_validate_pgda69.py
"""
import sys
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

sys.path.insert(0, str(Path(__file__).resolve().parent))
import validate as V  # noqa: E402


def test_compare_stats_known_values():
    # ours = 0.1, 0.2, 0.3 ; NASA = 0.2, 0.4, 0.6 -> diff -0.1, -0.2, -0.3, r = 1
    stats = V.compare_stats([0.1, 0.2, 0.3], [0.2, 0.4, 0.6])
    assert stats["n"] == 3
    assert stats["meanOurs"] == pytest.approx(0.2)
    assert stats["meanPgda"] == pytest.approx(0.4)
    assert stats["meanDifference"] == pytest.approx(-0.2)
    assert stats["rmse"] == pytest.approx(np.sqrt((0.01 + 0.04 + 0.09) / 3), abs=1e-4)
    assert stats["pearsonR"] == pytest.approx(1.0)


def test_compare_stats_constant_series_has_no_correlation():
    assert V.compare_stats([0.5, 0.5], [0.1, 0.9])["pearsonR"] is None
    assert V.compare_stats([], [])["n"] == 0


def make_raster(path, values_by_pixel):
    data = np.full((40, 40), -32768, dtype="int16")
    for (row, col), raw in values_by_pixel.items():
        data[row, col] = raw
    # 60 m pixels, top-left corner at (-1200, 1200), same axis layout as the PGDA 69 files
    with rasterio.open(path, "w", driver="GTiff", dtype="int16", count=1, width=40, height=40,
                       transform=from_origin(-1200, 1200, 60, 60), nodata=-32768) as dst:
        dst.write(data, 1)


def test_cell_mean_averages_pixels_inside_the_square_and_reads_the_centre(tmp_path):
    path = tmp_path / "synthetic.tif"
    values = {(r, c): 10000 for r in range(40) for c in range(40)}  # 0.4 everywhere
    values[(20, 20)] = 20000  # centre pixel of a cell at (0, 0) is 0.8
    make_raster(path, values)
    # a cell centred on pixel (20, 20): half side 90 m covers the 3 x 3 pixels around it
    mean, centre = V.read_pgda_cell_mean(path, 30.0, -30.0, half_side_m=90.0)
    assert mean == pytest.approx((8 * 0.4 + 0.8) / 9, abs=1e-4)
    assert centre == pytest.approx(0.8, abs=1e-4)
    assert V.read_pgda_cell_mean(path, 5000.0, 0.0, half_side_m=90.0) == (None, None)  # outside the raster


def test_cell_mean_is_none_when_most_pixels_are_nodata(tmp_path):
    path = tmp_path / "synthetic_nodata.tif"
    make_raster(path, {(20, 20): 10000})
    assert V.read_pgda_cell_mean(path, 30.0, -30.0, half_side_m=240.0)[0] is None
