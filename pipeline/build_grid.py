"""D2 — LGRS grid: USGS 1 km ACC shapefiles of the 9 Artemis III regions → cell centres.

Contract: README "D2 LGRS grid". Run: python pipeline/build_grid.py [--region MAL]
Input:  pipeline/raw/lgrs/<Region_Name>.zip, as downloaded by hand in a browser from https://doi.org/10.5066/P1MEQ6UK
        (ScienceBase blocks scripts). Only the 1 km file inside each zip is read; no need to unzip.
        Grid design: USGS Techniques and Methods 11-E1 (2025), https://doi.org/10.3133/tm11E1
Output: pipeline/out/grid_<CODE>.json = [{"id": "<CODE>-<label>", "label", "lat", "lon", "xM", "yM"}]
        label = the LGRS_ACC attribute; xM/yM in common.PGDA_CRS, converted from the shapefile's own CRS
        (LPS: polar stereographic on the 1737.4 km sphere, scale 0.994, false easting/northing 500 km).
"""
import argparse

import geopandas as gpd
from pyproj import Transformer

from common import MOON_LONLAT_CRS, OUT_FOLDER, PGDA_CRS, RAW_FOLDER, REGION_CODES, write_json

LGRS_FOLDER = RAW_FOLDER / "lgrs"
LABEL_ATTRIBUTE = "LGRS_ACC"
# Zip / folder name of each region in the USGS data release.
REGION_FOLDERS = {
    "CAB": "Peak_Near_Cabeus_B", "HAW": "Haworth", "MAL": "Malapert_Massif", "MMP": "Mons_Mouton_Plateau",
    "MMO": "Mons_Mouton", "NR1": "Nobile_Rim_1", "NR2": "Nobile_Rim_2", "DGR": "de_Gerlache_Rim_2", "SLP": "Slater_Plain",
}


def shapefile_path(region_code):
    folder = REGION_FOLDERS[region_code]
    return LGRS_FOLDER / f"{folder}.zip", f"{folder}/{folder}_PolarLGRS_ACC_1km_S_Grid.shp"


def read_region_grid(region_code):
    """Centre of each 1 km square of the region, in the README grid format."""
    zip_path, member = shapefile_path(region_code)
    squares = gpd.read_file(f"zip://{zip_path}!{member}")
    centres = squares.geometry.centroid
    lons, lats = Transformer.from_crs(squares.crs, MOON_LONLAT_CRS, always_xy=True).transform(centres.x.values, centres.y.values)
    xs, ys = Transformer.from_crs(squares.crs, PGDA_CRS, always_xy=True).transform(centres.x.values, centres.y.values)
    cells = [
        {"id": f"{region_code}-{label}", "label": label, "lat": round(lat, 5), "lon": round(lon, 5), "xM": round(x, 1), "yM": round(y, 1)}
        for label, lat, lon, x, y in zip(squares[LABEL_ATTRIBUTE], lats, lons, xs, ys)
    ]
    if len({cell["id"] for cell in cells}) != len(cells):
        raise ValueError(f"{region_code}: duplicate {LABEL_ATTRIBUTE} labels in {member}")
    return cells


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--region", choices=REGION_CODES, help="one region (default: every region whose zip is present)")
    args = parser.parse_args()
    for code in [args.region] if args.region else REGION_CODES:
        zip_path, _ = shapefile_path(code)
        if not zip_path.exists():
            print(f"warning: skip {code}, missing {zip_path.name} (download it in a browser, see the docstring)")
            continue
        cells = read_region_grid(code)
        print(f"{code}: {len(cells)} cells")
        write_json(OUT_FOLDER / f"grid_{code}.json", cells)
