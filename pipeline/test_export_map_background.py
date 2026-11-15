"""Tests for D8 — pipeline/export_map_background.py. Synthetic arrays, not real data.

Run: python -m pytest pipeline/test_export_map_background.py
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_map_background import (fraction_to_palette, fraction_to_rgba, overlay_bounds, psr_to_rgba,  # noqa: E402
                                   slope_class_indices)


def test_slope_classes_split_at_10_15_and_the_app_limit_of_20_degrees():
    classes = slope_class_indices(np.array([[0.0, 9.9, 10.0, 14.9], [15.0, 20.0, np.nan, 20.1]]), hatch_period_px=0)
    assert classes.tolist() == [[1, 1, 2, 2], [3, 3, 0, 4]]  # exactly 20° is still feasible, > 20° is not (common.SLOPE_LIMIT_DEG)


def test_steep_class_gets_hatch_stripes_only_on_steep_pixels():
    classes = slope_class_indices(np.full((8, 8), 30.0), hatch_period_px=4)
    assert set(np.unique(classes)) == {4, 5} and slope_class_indices(np.full((8, 8), 5.0), hatch_period_px=4).max() == 1


def test_fraction_indices_are_percent_steps_and_missing_is_index_zero():
    indices, palette = fraction_to_palette(np.array([[0.0, 0.5, 1.0, np.nan]]))
    assert indices.tolist() == [[1, 6, 11, 0]] and len(palette) == 12 and palette[0][3] == 0
    assert tuple(palette[1]) == (0x44, 0x01, 0x54, 255) and tuple(palette[11]) == (0xfd, 0xe7, 0x25, 255)


def test_fraction_to_rgba_uses_the_ramp_and_hides_missing_pixels():
    rgba = fraction_to_rgba(np.array([[0.0, 1.0], [0.5, np.nan]]))
    assert rgba.shape == (4, 2, 2) and rgba.dtype == np.uint8
    assert tuple(rgba[:, 0, 0]) == (0x44, 0x01, 0x54, 255)
    assert tuple(rgba[:, 0, 1]) == (0xfd, 0xe7, 0x25, 255)
    assert tuple(rgba[:, 1, 0]) == (0x21, 0x91, 0x8c, 255)
    assert rgba[3, 1, 1] == 0


def test_psr_to_rgba_colours_only_permanent_shadow():
    rgba = psr_to_rgba(np.array([[1.0, 0.0], [np.nan, 1.0]]))
    assert rgba[3].tolist() == [[255, 0], [0, 255]]
    assert tuple(rgba[:3, 0, 0]) == (0xcc, 0x79, 0xa7)


def test_overlay_bounds_clips_a_region_window_to_the_raster():
    raster = (-151740.0, -151740.0, 151740.0, 151740.0)
    assert overlay_bounds([-13120, 108640, 12000, 134800], raster) == [-13120, 108640, 12000, 134800]
    assert overlay_bounds([144880, 82560, 168960, 107680], raster) == [144880, 82560, 151740.0, 107680]
    assert overlay_bounds([-192160, 57360, -167040, 82480], raster) is None
