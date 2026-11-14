import argparse
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer

# Ensure common.py can be imported when running from the repository root
PIPE_DIR = Path(__file__).resolve().parent
if str(PIPE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPE_DIR))

import common

MOON_RADIUS_M = 1_737_400.0
MAST_HEIGHT_M = float(getattr(common, "MAST_HEIGHT_M", 2.0))
PGDA_CRS = getattr(
    common,
    "PGDA_CRS",
    "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs",
)

RAW_DIR = Path(getattr(common, "RAW_DIR", PIPE_DIR / "raw"))
OUT_DIR = Path(getattr(common, "OUT_DIR", PIPE_DIR / "out"))
SITES_PATH = Path(getattr(common, "SITES_PATH", PIPE_DIR / "sites.json"))

NEAR_DEM_PATH = RAW_DIR / "LDEM_80S_80MPP_ADJ.TIF"
FAR_DEM_PATH = RAW_DIR / "LDEM_60S_240MPP_ADJ.TIF"

LONLAT_CRS = CRS.from_proj4("+proj=longlat +R=1737400 +no_defs")
TO_XY = Transformer.from_crs(LONLAT_CRS, CRS.from_user_input(PGDA_CRS), always_xy=True)


def build_sample_distances() -> np.ndarray:
    """Build sample distances from 100 m to 150 km with step growing with distance."""
    d_near = np.arange(100.0, 5_000.0, 80.0, dtype=np.float64)
    d_mid = np.arange(5_000.0, 30_000.0, 240.0, dtype=np.float64)
    d_far = np.arange(30_000.0, 150_001.0, 500.0, dtype=np.float64)
    return np.concatenate([d_near, d_mid, d_far])


SAMPLE_DISTANCES = build_sample_distances()
AZIMUTHS_DEG = np.arange(360, dtype=np.float64)


def load_dem(tif_path: Path) -> tuple[np.ndarray, rasterio.Affine]:
    """Load a GeoTIFF into memory as a float32 array with nodata mapped to NaN."""
    if not tif_path.exists():
        raise FileNotFoundError(
            f"Missing DEM file {tif_path}. Run: python pipeline/download_data.py"
        )
    with rasterio.open(tif_path) as src:
        data = src.read(1).astype(np.float32)
        if src.nodata is not None and not np.isnan(src.nodata):
            data[data == src.nodata] = np.nan
        return data, src.transform


def _unpack_dem(dem_obj) -> tuple[np.ndarray, rasterio.Affine]:
    """Support passing either a (data, transform) tuple or a rasterio dataset."""
    if isinstance(dem_obj, tuple) and len(dem_obj) == 2:
        return dem_obj
    if hasattr(dem_obj, "read") and hasattr(dem_obj, "transform"):
        data = dem_obj.read(1).astype(np.float32)
        if dem_obj.nodata is not None and not np.isnan(dem_obj.nodata):
            data[data == dem_obj.nodata] = np.nan
        return data, dem_obj.transform
    raise TypeError("DEM must be a (data, transform) tuple or a rasterio DatasetReader.")


def bilinear_sample(
    data: np.ndarray, transform: rasterio.Affine, x: np.ndarray, y: np.ndarray
) -> np.ndarray:
    """Vectorized bilinear interpolation on a 2D NumPy raster array."""
    inv_tf = ~transform
    cols, rows = inv_tf * (x, y)

    r = rows - 0.5
    c = cols - 0.5

    r0 = np.floor(r).astype(np.int32)
    c0 = np.floor(c).astype(np.int32)
    r1 = r0 + 1
    c1 = c0 + 1

    h, w = data.shape
    valid = (r0 >= 0) & (r1 < h) & (c0 >= 0) & (c1 < w)

    r0_c = np.clip(r0, 0, h - 1)
    r1_c = np.clip(r1, 0, h - 1)
    c0_c = np.clip(c0, 0, w - 1)
    c1_c = np.clip(c1, 0, w - 1)

    dr = r - r0
    dc = c - c0

    v00 = data[r0_c, c0_c]
    v01 = data[r0_c, c1_c]
    v10 = data[r1_c, c0_c]
    v11 = data[r1_c, c1_c]

    interpolated = (
        (1.0 - dr) * (1.0 - dc) * v00
        + (1.0 - dr) * dc * v01
        + dr * (1.0 - dc) * v10
        + dr * dc * v11
    )
    return np.where(valid, interpolated, np.nan)


def compute_horizon(
    lat: float,
    lon: float,
    near_dem,
    far_dem,
    x_m: float | None = None,
    y_m: float | None = None,
) -> list[int]:
    """
    Compute the 360-azimuth terrain horizon elevations in units of 0.1 degrees.
    Formula: angle = atan2(h_sample - h_cell - mast - d^2 / (2R), d).
    """
    near_data, near_tf = _unpack_dem(near_dem)
    far_data, far_tf = _unpack_dem(far_dem)

    if x_m is None or y_m is None:
        x_m, y_m = TO_XY.transform(float(lon), float(lat))

    x0 = np.array([float(x_m)], dtype=np.float64)
    y0 = np.array([float(y_m)], dtype=np.float64)

    h_cell = bilinear_sample(near_data, near_tf, x0, y0)[0]
    if np.isnan(h_cell):
        h_cell = bilinear_sample(far_data, far_tf, x0, y0)[0]
    if np.isnan(h_cell):
        return [0] * 360

    # In PGDA_CRS (+x points to 90 deg E, +y points to 0 deg meridian),
    # a ray at azimuth k deg at longitude lon has grid angle (lon + k) clockwise from +y.
    ray_angles_rad = np.deg2rad(float(lon) + AZIMUTHS_DEG)[:, None]
    d = SAMPLE_DISTANCES[None, :]

    sample_x = float(x_m) + d * np.sin(ray_angles_rad)
    sample_y = float(y_m) + d * np.cos(ray_angles_rad)

    h_sample = bilinear_sample(near_data, near_tf, sample_x, sample_y)
    missing_mask = np.isnan(h_sample)
    if np.any(missing_mask):
        h_sample[missing_mask] = bilinear_sample(
            far_data, far_tf, sample_x[missing_mask], sample_y[missing_mask]
        )

    curvature_drop = (d * d) / (2.0 * MOON_RADIUS_M)
    delta_h = h_sample - float(h_cell) - MAST_HEIGHT_M - curvature_drop
    angles_deg = np.rad2deg(np.arctan2(delta_h, d))

    all_nan_rays = np.all(np.isnan(angles_deg), axis=1)
    angles_deg[all_nan_rays, 0] = 0.0

    max_angles_deg = np.nanmax(angles_deg, axis=1)
    horizon_tenths = np.rint(10.0 * max_angles_deg).astype(int)
    return horizon_tenths.tolist()


def load_valid_sites() -> list[dict]:
    """Load valid sites (excluding TODO entries) from common.load_sites or sites.json."""
    if hasattr(common, "load_sites"):
        loaded = common.load_sites()
        if isinstance(loaded, dict) and "sites" in loaded:
            return loaded["sites"]
        if isinstance(loaded, list):
            return loaded

    with open(SITES_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    sites = raw["sites"] if isinstance(raw, dict) and "sites" in raw else raw
    return [
        s
        for s in sites
        if s.get("source") != "TODO"
        and s.get("lat") is not None
        and s.get("lon") is not None
    ]


def get_region_codes() -> list[str]:
    """Return the 9 Artemis III region codes from common.py or the default list."""
    if hasattr(common, "REGIONS"):
        reg = common.REGIONS
        if isinstance(reg, dict):
            return list(reg.keys())
        if isinstance(reg, (list, tuple)):
            return [r["code"] if isinstance(r, dict) else str(r) for r in reg]
    return ["CAB", "HAW", "MAL", "MMP", "MMO", "NR1", "NR2", "DGR", "SLP"]


def run_sites(near_dem, far_dem) -> dict[str, list[int]]:
    """Compute horizons for all sites with lat <= -60 deg and write horizon_sites.json."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sites = load_valid_sites()
    horizon_sites: dict[str, list[int]] = {}

    for site in sites:
        lat = float(site["lat"])
        lon = float(site["lon"])
        if lat <= -60.0:
            site_id = site["id"]
            print(f"[sites] Computing horizon for {site_id} ({lat:.3f}, {lon:.3f})...")
            horizon_sites[site_id] = compute_horizon(lat, lon, near_dem, far_dem)

    out_file = OUT_DIR / "horizon_sites.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(horizon_sites, f, separators=(",", ":"))
    print(f"[sites] Saved {len(horizon_sites)} sites to {out_file}")
    return horizon_sites


def run_region(code: str, near_dem, far_dem) -> bool:
    """Compute horizons for all cells in grid_<CODE>.json and write horizon_<CODE>.json."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    grid_file = OUT_DIR / f"grid_{code}.json"
    if not grid_file.exists():
        print(f"[{code}] Skipping: {grid_file} not found")
        return False

    with open(grid_file, "r", encoding="utf-8") as f:
        grid_data = json.load(f)
    cells = grid_data["cells"] if isinstance(grid_data, dict) and "cells" in grid_data else grid_data

    horizon_cells: dict[str, list[int]] = {}
    total = len(cells)
    print(f"[{code}] Computing horizon for {total} cells...")

    for idx, cell in enumerate(cells, start=1):
        horizon_cells[cell["id"]] = compute_horizon(
            float(cell["lat"]),
            float(cell["lon"]),
            near_dem,
            far_dem,
            x_m=cell.get("xM"),
            y_m=cell.get("yM"),
        )
        if idx % 50 == 0 or idx == total:
            print(f"[{code}] Completed {idx}/{total} cells")

    out_file = OUT_DIR / f"horizon_{code}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(horizon_cells, f, separators=(",", ":"))
    print(f"[{code}] Saved {out_file}")
    return True


def plot_malapert_horizon(horizon_sites: dict[str, list[int]], save_path: Path) -> None:
    """Plot the 360-degree horizon at Malapert Massif centre for visual verification."""
    if "malapert-massif" not in horizon_sites:
        print("Site 'malapert-massif' not found in horizon_sites for plotting.")
        return

    import matplotlib.pyplot as plt

    mal_deg = np.array(horizon_sites["malapert-massif"], dtype=float) / 10.0
    az = np.arange(360)

    plt.figure(figsize=(12, 4.5))
    plt.fill_between(az, -5.0, mal_deg, color="#4a5568", alpha=0.85, label="Terrain Horizon")
    plt.plot(az, mal_deg, color="#1a202c", linewidth=1.2)
    plt.axhline(0.0, color="#718096", linestyle="--", linewidth=0.8, label="0° Flat Horizon")
    plt.xlim(0, 359)
    plt.ylim(min(-5.0, float(mal_deg.min()) - 1.0), max(15.0, float(mal_deg.max()) + 2.0))
    plt.xticks(
        [0, 45, 90, 135, 180, 225, 270, 315, 359],
        ["0° (N)", "45° (NE)", "90° (E)", "135° (SE)", "180° (S)", "225° (SW)", "270° (W)", "315° (NW)", "359°"],
    )
    plt.xlabel("Azimuth (°)")
    plt.ylabel("Elevation (°)")
    plt.title("Malapert Massif Centre — 360° Terrain Horizon")
    plt.legend(loc="upper right")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"[plot] Saved horizon check plot to {save_path}")


def main():
    parser = argparse.ArgumentParser(description="D4: Compute 360-degree terrain horizons.")
    parser.add_argument(
        "--region",
        type=str,
        default=None,
        help="Region code to compute (e.g. MAL) or ALL for all 9 regions.",
    )
    parser.add_argument(
        "--sites",
        action="store_true",
        help="Compute horizons for sites with lat <= -60 deg in pipeline/sites.json.",
    )
    parser.add_argument(
        "--plot",
        action="store_true",
        help="Export Malapert centre horizon plot to pipeline/raw/check_malapert_horizon.png.",
    )
    args = parser.parse_args()

    print("Loading DEM rasters into memory...")
    near_dem = load_dem(NEAR_DEM_PATH)
    far_dem = load_dem(FAR_DEM_PATH)

    run_all_default = not args.sites and args.region is None

    horizon_sites = None
    if args.sites or run_all_default:
        horizon_sites = run_sites(near_dem, far_dem)

    if args.plot:
        if horizon_sites is None:
            sites_out = OUT_DIR / "horizon_sites.json"
            if sites_out.exists():
                with open(sites_out, "r", encoding="utf-8") as f:
                    horizon_sites = json.load(f)
            else:
                horizon_sites = run_sites(near_dem, far_dem)
        plot_malapert_horizon(horizon_sites, RAW_DIR / "check_malapert_horizon.png")

    if args.region:
        codes = get_region_codes() if args.region.upper() == "ALL" else [args.region.upper()]
        for code in codes:
            run_region(code, near_dem, far_dem)
    elif run_all_default:
        for code in get_region_codes():
            run_region(code, near_dem, far_dem)


if __name__ == "__main__":
    main()