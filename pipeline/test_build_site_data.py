"""Tests for D5 — pipeline/build_site_data.py. Synthetic cells, not real data.

Run: python -m pytest pipeline/test_build_site_data.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_site_data import TO_PGDA, build_cell, keep_nearest_cells  # noqa: E402


def make_cell(cell_id, x_m, y_m):
    return {"id": cell_id, "xM": x_m, "yM": y_m}


def test_keep_nearest_cells_keeps_the_closest_in_grid_order():
    site = {"lat": -85.0, "lon": 30.0}
    centre_x, centre_y = TO_PGDA.transform(site["lon"], site["lat"])
    # Grid order a, b, c, d; distances from the centre 3 km, 1 km, 5 km, 2 km.
    cells = [make_cell("a", centre_x + 3000, centre_y), make_cell("b", centre_x, centre_y - 1000),
             make_cell("c", centre_x - 5000, centre_y), make_cell("d", centre_x, centre_y + 2000)]
    assert [cell["id"] for cell in keep_nearest_cells(cells, site, 2)] == ["b", "d"]
    assert keep_nearest_cells(cells, site, 10) == cells


def test_build_cell_applies_the_rule_slope_first():
    horizon = [0] * 360
    assert build_cell({"id": "x"}, {"slopeDeg": 20.0, "psrFraction": 0.5}, horizon)["infeasibleReason"] is None
    steep_and_dark = build_cell({"id": "x"}, {"slopeDeg": 20.1, "psrFraction": 0.9}, horizon)
    assert (steep_and_dark["feasible"], steep_and_dark["infeasibleReason"]) == (False, "slope")
    assert build_cell({"id": "x"}, {"slopeDeg": 5.0, "psrFraction": 0.501}, horizon)["infeasibleReason"] == "psr"
