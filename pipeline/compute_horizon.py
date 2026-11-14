"""D4 — Terrain horizon: 360 rays per cell, max elevation angle per 1° azimuth.

Contract: README "D4 Terrain horizon". Run: python pipeline/compute_horizon.py --region MAL   (or --sites)
Input:  pipeline/out/grid_<CODE>.json or pipeline/sites.json (sites with lat ≤ -60)
        pipeline/raw/LDEM_80S_80MPP_ADJ.TIF (near, 80–90°S), pipeline/raw/LDEM_60S_240MPP_ADJ.TIF (far, outside 80°S)
Output: pipeline/out/horizon_<CODE>.json or pipeline/out/horizon_sites.json = {"<id>": [360 ints, 0.1° units]}
Method: window-finder.md §5.4 — ray k at azimuth k° (clockwise from North), samples from 100 m to 150 km with growing
        steps, angle = atan2(h_sample − h_cell − mast − d²/(2R), d), horizon[k] = round(10 × max angle in degrees).
"""
from common import MAST_HEIGHT_M


def compute_horizon(lat, lon, near_dem, far_dem, mast_height_m=MAST_HEIGHT_M):
    """@returns list of 360 ints (0.1° units, may be negative)."""
    raise NotImplementedError("D4 compute_horizon")


if __name__ == "__main__":
    raise SystemExit("Not implemented yet: D4 compute_horizon.py")
