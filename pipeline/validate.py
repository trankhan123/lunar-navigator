"""D7 — Validation against NASA PGDA 69 (and the Horizons vector check from D1).

Contract: README "D7 Validation" and "validation.json". Run: python pipeline/validate.py
Input:  web/public/data/cells_<CODE>.json, pipeline/raw/AVGVISIB_85S_060M_201608.TIF and ..._EARTH.TIF
        (pixel value × 4e-05 = fraction of time visible; 18.6-year average, covers 85–90°S only, so CAB, MMP, NR2 have no PGDA value)
        pipeline/out/our_visibility.json = {"<cellId>": {"sunFraction", "earthFraction"}} from the browser core over the whole
        ephemeris (D7 writes a small node script that imports web/src/core/sunlight.js and communication.js)
Output: web/public/data/validation.json
"""


def read_pgda_fraction(raster, lat, lon):
    raise NotImplementedError("D7 read_pgda_fraction")


if __name__ == "__main__":
    raise SystemExit("Not implemented yet: D7 validate.py")
