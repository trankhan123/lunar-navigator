"""Tests for pipeline/build_cap_grid.py. Synthetic arrays and cells, not real data.

Run: python -m pytest pipeline/test_build_cap_grid.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_cap_grid as cap  # noqa: E402


def test_select_keeps_a_disk_and_drops_region_bounds():
    # radius 3000 m: centres at (±1000, ±1000) are 1414 m away, (±3000, ±1000) 3162 m away (outside)
    all_cells = cap.select_cell_indices(3000, [])
    expected = [(i, j) for i in range(-2, 2) for j in range(-2, 2) if ((i + .5) ** 2 + (j + .5) ** 2) ** .5 * 2000 <= 3000]
    assert sorted(all_cells) == sorted(expected)
    without_region = cap.select_cell_indices(3000, [[0, 0, 2000, 2000]])  # contains the centre (1000, 1000)
    assert (0, 0) in all_cells and (0, 0) not in without_region
    assert len(without_region) == len(all_cells) - 1


def test_cell_id_is_zero_padded_row_and_column():
    assert cap.cell_id(75, 112) == "CAP-r075c112"
    assert cap.cell_id(0, 5) == "CAP-r000c005"


def test_rows_and_columns_count_from_the_smallest_index():
    cells = cap.make_grid_cells([(-3, 4), (-2, 4), (-3, 6)])
    assert [cell["id"] for cell in cells] == ["CAP-r000c000", "CAP-r000c001", "CAP-r002c000"]
    assert cells[0]["label"] == "r000c000"
    assert (cells[0]["xM"], cells[0]["yM"]) == (-5000.0, 9000.0)


def test_tiles_are_40_km_squares_aligned_to_multiples():
    assert cap.tile_of(39999.9, 0.0) == (0, 0)
    assert cap.tile_of(40000.0, -0.1) == (1, -1)
    assert cap.tile_of(-0.1, -40000.1) == (-1, -2)
    assert cap.tile_bounds(-1, 2) == [-40000, 80000, 0, 120000]


def test_split_into_tiles_and_index_counts():
    cells = [{"id": "a", "xM": 1000.0, "yM": 1000.0, "feasible": True},
             {"id": "b", "xM": 3000.0, "yM": 1000.0, "feasible": False},
             {"id": "c", "xM": -1000.0, "yM": 1000.0, "feasible": True}]
    tiles = cap.split_into_tiles(cells)
    assert sorted(tiles) == [(-1, 0), (0, 0)]
    index = cap.build_index(tiles, ["MAL"])
    assert (index["cellCount"], index["feasibleCount"]) == (3, 2)
    assert index["tiles"][1] == {"id": "cap_0_0", "boundsM": [0, 0, 40000, 40000], "cellCount": 2, "feasibleCount": 1}
    assert index["cellSizeM"] == 2000 and index["tileSizeM"] == 40000 and index["southOfLatDeg"] == -85
    assert index["gridSize"] == 3  # x centres -1000..3000 m
    assert index["excludedRegionCodes"] == ["MAL"]
