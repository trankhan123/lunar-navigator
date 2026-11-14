"""D2 — LGRS grid: USGS 1 km ACC shapefiles of the 9 Artemis III regions → cell centres.

Contract: README "D2 LGRS grid". Run: python pipeline/build_grid.py
Input:  pipeline/raw/lgrs/ (download by hand in a browser from https://doi.org/10.5066/P1MEQ6UK — ScienceBase blocks scripts)
        Grid design: USGS Techniques and Methods 11-E1 (2025), https://doi.org/10.3133/tm11E1
Output: pipeline/out/grid_<CODE>.json = [{"id": "<CODE>-<label>", "label", "lat", "lon", "xM", "yM"}]
        xM/yM in common.PGDA_CRS (convert from the shapefile CRS; USGS suggests IAU_2015:30100 or ESRI:104903).
"""
from common import REGION_CODES


def read_region_grid(region_code):
    """Open the 1 km shapefile with geopandas, take each square's centre, return the list above.
    Label = the ACC 1 km label attribute (write its name in README); fallback f"r{row}c{col}"."""
    raise NotImplementedError("D2 read_region_grid")


if __name__ == "__main__":
    print("regions:", ", ".join(REGION_CODES))
    raise SystemExit("Not implemented yet: D2 build_grid.py")
