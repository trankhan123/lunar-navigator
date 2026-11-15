"""Tests for the relief tile pyramid — pipeline/export_relief_tiles.py. Synthetic arrays, not real data.

Run: python -m pytest pipeline/test_export_relief_tiles.py
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_relief_tiles import (BACKGROUND_RGB, TILE_PX, contour_strength, elevation_tint, render_tile, shaded_relief,  # noqa: E402
                                 tile_bounds_m, tile_is_wanted)


def test_flat_ground_is_lit_by_the_sun_altitude_only():
    shade = shaded_relief(np.zeros((6, 6)), pixel_size_m=80, altitude_deg=30)
    assert shade.shape == (4, 4) and np.allclose(shade, 0.5)  # sin(30°)


def test_a_slope_facing_the_light_is_brighter_than_one_facing_away():
    ramp = np.tile(np.arange(8) * 40.0, (8, 1))  # rises towards the east, so it faces west
    lit_from_west = shaded_relief(ramp, 80, azimuths_deg=[270])
    lit_from_east = shaded_relief(ramp, 80, azimuths_deg=[90])
    assert lit_from_west.mean() > lit_from_east.mean()


def test_elevation_tint_hits_the_stops_and_clamps_outside_them():
    stops = [(-1000, "#000000"), (1000, "#ffffff")]
    assert elevation_tint(np.array([-5000, 0, 1000, 9000.0]), stops).tolist() == [[0, 0, 0], [128, 128, 128], [255, 255, 255], [255, 255, 255]]


def test_contours_appear_where_the_elevation_crosses_a_multiple_of_the_interval():
    block = np.zeros((6, 6))
    block[:, 3:] = 300.0  # a step across 250 m
    strength = contour_strength(block, interval_m=250)
    assert strength.shape == (4, 4) and strength[:, 1].min() > 0 and strength[:, 0].max() == 0 and strength[:, 3].max() == 0


def test_tile_geometry_covers_the_square_row_zero_is_north():
    assert tile_bounds_m(0, 0, 0) == [-304000, -304000, 304000, 304000]
    assert tile_bounds_m(1, 1, 0) == [0, 0, 304000, 304000]
    assert tile_bounds_m(2, 0, 3) == [-304000, -304000, -152000, -152000]


def test_finest_tiles_are_kept_only_near_the_disk_or_a_region():
    disk, regions = 151740, [[-192160, 57360, -167040, 82480]]
    assert tile_is_wanted([-10000, -10000, 10000, 10000], disk, regions)  # the pole
    assert not tile_is_wanted([250000, 250000, 300000, 300000], disk, regions)  # far corner
    assert tile_is_wanted([-200000, 50000, -160000, 90000], disk, regions)  # outside the disk, inside a region frame


def test_render_tile_returns_a_tile_sized_rgb_image_with_background_where_there_is_no_data():
    block = np.full((TILE_PX + 2, TILE_PX + 2), np.nan)
    block[:, : TILE_PX // 2] = 100.0
    rgb = render_tile(block, pixel_size_m=80, contour_interval_m=500, stops=[(0, "#202020"), (1000, "#e0e0e0")])
    assert rgb.shape == (TILE_PX, TILE_PX, 3) and rgb.dtype == np.uint8
    assert tuple(rgb[10, TILE_PX - 10]) == BACKGROUND_RGB and tuple(rgb[10, 10]) != BACKGROUND_RGB
