"""D3 — Landing feasibility per cell: height, median slope, permanent-shadow share.

Contract: README "D3 Feasibility". Run: python pipeline/compute_feasibility.py --region MAL
Input:  pipeline/out/grid_<CODE>.json
        pipeline/raw/LDSM_80S_80MPP_ADJ.TIF (slope, degrees), pipeline/raw/LPSR_80S_20MPP_ADJ.TIF (permanent shadow),
        pipeline/raw/LDEM_80S_80MPP_ADJ.TIF (height, metres)
Output: pipeline/out/feasibility_<CODE>.json = {"<cellId>": {"heightM", "slopeDeg", "psrFraction"}}
        slopeDeg = median over the 1 km square; psrFraction = share of PSR pixels in the square; heightM = DEM at the centre.
"""


def compute_cell_feasibility(cell, slope_raster, psr_raster, dem_raster):
    raise NotImplementedError("D3 compute_cell_feasibility")


if __name__ == "__main__":
    raise SystemExit("Not implemented yet: D3 compute_feasibility.py")
