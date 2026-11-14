"""D8 — Map backgrounds for the 2D south-pole map: hillshade (and optional PGDA 69 Sun overlay) → PNG.

Contract: README "D8 Map background". Run: python pipeline/export_map_background.py
Input:  pipeline/raw/LDEM_80S_80MPP_ADJ_HILL.TIF, pipeline/raw/AVGVISIB_85S_060M_201608.TIF, web/public/data/regions.json
Output: web/public/maps/south_pole.png (whole pole), web/public/maps/region_<CODE>.png (one per region),
        web/public/maps/maps.json = {"maps": [{"id", "kind": "hillshade"|"sun-visibility", "image", "boundsM", "metersPerPixel"}]}
        boundsM = [xMin, yMin, xMax, yMax] in common.PGDA_CRS. Write PNG with rasterio (GDAL PNG driver), no new library.
"""

if __name__ == "__main__":
    raise SystemExit("Not implemented yet: D8 export_map_background.py")
