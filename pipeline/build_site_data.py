"""D5 — Build web data: merge grid + feasibility + horizon into the files the browser loads.

Contract: README "Data files". Run: python pipeline/build_site_data.py && python pipeline/check_web_data.py
Input:  pipeline/out/grid_<CODE>.json, feasibility_<CODE>.json, horizon_<CODE>.json, horizon_sites.json, pipeline/sites.json
Output: web/public/data/regions.json, web/public/data/cells_<CODE>.json, web/public/data/sites.json (each < 2 MB)
Rules:  feasible = slopeDeg ≤ SLOPE_LIMIT_DEG and psrFraction ≤ PSR_LIMIT_FRACTION;
        infeasibleReason = "slope" first, then "psr", else null. Regions with no grid yet are left out with a warning.
"""
from common import PSR_LIMIT_FRACTION, SLOPE_LIMIT_DEG


def build_region(region_site):
    raise NotImplementedError("D5 build_region")


def build_sites():
    raise NotImplementedError("D5 build_sites")


if __name__ == "__main__":
    print(f"slope limit {SLOPE_LIMIT_DEG}°, PSR limit {PSR_LIMIT_FRACTION}")
    raise SystemExit("Not implemented yet: D5 build_site_data.py")
