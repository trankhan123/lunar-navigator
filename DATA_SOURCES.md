# DATA_SOURCES.md — every data file, URL and library

Data retrieval date: 2026-11-14. When you add a new source: add a line here and in `REFERENCES.md`.

## 1. Downloaded files (`pipeline/download_data.py` reads this table)

Run: `pip install -r pipeline/requirements.txt && python pipeline/download_data.py`. Files that already exist are skipped.
The link `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/` (the folder) returns 404, but links to the individual files still download.

| File | URL | Save to | Size | Used for |
|---|---|---|---|---|
| LDEM_80S_80MPP_ADJ.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF | pipeline/raw | 180 MB | LOLA DEM 80 m/px, 80–90°S (PGDA 90) → compute the horizon |
| LDEM_80S_80MPP_ADJ_HILL.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ_HILL.TIF | pipeline/raw | 84 MB | Hillshade (PGDA 90) → background image of the 2D south pole map |
| LDSM_80S_80MPP_ADJ.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDSM_80S_80MPP_ADJ.TIF | pipeline/raw | 231 MB | Slope 80 m/px, 80–90°S (PGDA 90) → module D3 feasible cells (20° limit) |
| LPSR_80S_20MPP_ADJ.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LPSR_80S_20MPP_ADJ.TIF | pipeline/raw | 148 MB | Permanently shadowed regions 20 m/px, 80–90°S (PGDA 90) → module D3 + map overlay (D8) |
| LDEM_60S_240MPP_ADJ.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF | pipeline/raw | 210 MB | DEM 240 m/px, 60–90°S (PGDA 90) → module D4, the far horizon beyond 80°S, sites like Chandrayaan-3 |
| AVGVISIB_85S_060M_201608.TIF | https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608.TIF | pipeline/raw | 32 MB | % of time the Sun is visible, 85–90°S (PGDA 69) → validation + map overlay. D7 compares: mean of the 60 m pixels in each 1 km cell, 240 sample cells (8 regions × 30) |
| AVGVISIB_85S_060M_201608_EARTH.TIF | https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608_EARTH.TIF | pipeline/raw | 24 MB | % of time Earth is visible (PGDA 69) → validation + map overlay (D8). D7 compares: mean of the 60 m pixels in each 1 km cell, 240 sample cells (8 regions × 30) |
| LPSR_85S_060M_201608.TIF | https://pgda.gsfc.nasa.gov/data/MoonIllumination/LPSR_85S_060M_201608.TIF | pipeline/raw | 0.6 MB | Permanently shadowed regions (PGDA 69) → extra feature "permanently shadowed region outline" |
| lroc_color_2k.jpg | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg | web/public/textures | 0.4 MB | Moon texture for globe.gl (NASA SVS 4720, CGI Moon Kit) |

Source pages: PGDA 90 https://pgda.gsfc.nasa.gov/products/90 · PGDA 69 https://pgda.gsfc.nasa.gov/products/69 · SVS 4720 https://svs.gsfc.nasa.gov/4720

## 2. API

Optional chat only: Google Gemini API (https://aistudio.google.com/docs/structured-output)
extracts form parameters; Upstash Redis REST (https://upstash.com/docs/redis/features/restapi)
stores usage counters. Neither supplies scientific results or new lunar data.

| Source | URL | Used for |
|---|---|---|
| JPL Horizons API (ephemeris) | https://ssd.jpl.nasa.gov/api/horizons.api | Module D1: `COMMAND=301`, `CENTER=500@399`, `QUANTITIES=14,15,19,20`, 1h step, 2027-01-01 → 2029-01-31, split by quarter → `web/public/data/ephemeris.json`. Cached in `pipeline/raw/horizons/` |
| JPL Horizons API (validation) | https://ssd.jpl.nasa.gov/api/horizons.api | Sun azimuth/elevation (`COMMAND=10`) and Earth (`COMMAND=399`) at a point (`CENTER=coord@301`, `QUANTITIES=4`) → fixture `web/src/core/fixtures/horizons_check.json`. 1h step works, 1 month = 745 rows |
| JPL Horizons API (DSN stations - Task 11) | https://ssd.jpl.nasa.gov/api/horizons.api | Apparent elevation of the Moon (`COMMAND=301`) seen from 3 DSN stations on Earth (`CENTER=coord@399`, `QUANTITIES=4`: Goldstone DSS-14, Madrid DSS-63, Canberra DSS-43), 1h step, 2027-01-01 → 2029-01-31 (18,288 h) → `web/public/data/dsn.json` (unit 0.1°). Cached in `pipeline/raw/horizons_dsn/` |
| JPL Horizons API (Mission Replay - E6) | https://ssd.jpl.nasa.gov/api/horizons.api | Same parameters as D1 (`COMMAND=301`, `CENTER=500@399`, `QUANTITIES=14,15,19,20`, 1h step), 3 short windows around the real landing dates of IM-1, IM-2, Chandrayaan-3 → `web/public/data/replay/<siteId>.json` (`pipeline/fetch_replay.py`). Cached in `pipeline/raw/horizons/` |

## 3. Site coordinates (`pipeline/sites.json`, not invented)

NASA publishes only the names and maps of the 9 Artemis III regions, not numeric coordinates. The coordinates in use come from these sources:

| Source | URL | Used for |
|---|---|---|
| NTRS 20250011660 — Artemis III Site Selection Update (list of 9 regions, no coordinates) | https://ntrs.nasa.gov/citations/20250011660 | Region names |
| NASA news release 2024-10-28 — NASA Provides Update on Artemis III Moon Landing Regions | https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ | Region names, maps |
| USGS data release, McClernan 2024 — Down Selected Artemis III Candidate Landing Site Navigational Grids (ScienceBase item 671a6fa8d34efed5620f89f8) | https://doi.org/10.5066/P1MEQ6UK | Region square cells (origin of the region centers) and the **1 km LGRS ACC grid shapefiles of the 9 regions for module D2**. Must be downloaded with a browser into `pipeline/raw/lgrs/` (scripts get 403) |
| USGS Techniques and Methods 11-E1 (2025) — Lunar grid systems, coordinate systems, and map projections for the Artemis missions and lunar surface navigation | https://doi.org/10.3133/tm11E1 | Design of LGRS, LPS, Artemis Condensed Coordinates (read to understand cell labels) |
| USGS data release — Artemis III candidate landing site navigational grids, 13 original regions from 2022 and Apollo 11–17 (ScienceBase item 67168797d34ebf903f48b6fc) | https://doi.org/10.5066/P13FD9ZD | **Not used yet.** For E9 (add Peak near Shackleton, Connecting Ridge… on the 1 km grid). Download with a browser into `pipeline/raw/lgrs/` |
| USGS data release — global LGRS grid, LTM/LPS projection | https://doi.org/10.5066/P13YPWQD | **Not used yet.** For E10 (25 km grid layer and cell labels). Download with a browser into `pipeline/raw/lgrs_global/` |
| USGS Astropedia — Lunar Map Projections and Grid Reference System (doi:10.5066/P1SZQZDB, 12.5 GB, global) | https://astrogeology.usgs.gov/search/map/lunar-map-projections-and-grid-reference-system-for-artemis-astronaut-surface-navigation | Not used (too large); listed for reference only |
| NASA NTRS 20250009323 — Artemis overview for Space Apps 2025 (HLS: slope limit, lighting, communication) | https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf | The 20° slope limit of module D3 |
| MoonSnag Mission Watch site registry (centers of USGS square cells) | https://moonsnag.com/coordination | Coordinates of the 9 regions, `verified: false` |
| realestateonthemoon.com (quoting the NASA Lunar Surface Data Book) | https://realestateonthemoon.com/lunar-south-pole/ | Cross-check only |
| NASA NSSDCA Apollo Landing Site Coordinates (Wagner et al. 2017) | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html | Apollo 11, 12, 14, 15, 16, 17, `verified: true` |
| NASA NSSDCA Table of Anthropogenic Impacts and Spacecraft on the Moon | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html | IM-1, IM-2, Blue Ghost 1, Chang'e 3–6, Chandrayaan-3, SLIM, `verified: true` |
| NASA Science Activation — NASA Sees Interns Tackle Real-World Challenges in Lunar Exploration | https://science.nasa.gov/learning-resources/science-activation/nasa-sees-interns-tackle-real-world-challenges-in-lunar-exploration/ | IM-3 (mission planned for Reiner Gamma, no confirmed coordinates yet) |

## 4. Libraries

| Library | Version | Used in |
|---|---|---|
| requests | 2.34.2 | pipeline |
| numpy | 2.5.4 | pipeline |
| rasterio | 1.5.2 | pipeline |
| pyproj | 3.8.0 | pipeline |
| geopandas (brings pyogrio 0.13.0, shapely 2.2.0, pandas) | 1.2.0 | pipeline, module D2 reads the LGRS shapefile |
| vite | 8.3.x | web |
| react, react-dom | 19.3.x | web |
| tailwindcss, @tailwindcss/vite | 4.3.5 | web |
| globe.gl | 2.46.2 | web |
| d3-zoom, d3-selection (every d3 package, globe.gl's included, pinned with `overrides` in web/package.json to its release before 2026-11-03) | 3.0.0 | web (components/SouthPoleMap.jsx) |
| echarts | 6.1.0 | web |
| echarts-for-react | 3.0.6 | web |
| three | 0.187.0 (pinned exactly; globe.gl uses the same version) | web (`components/TerrainView3D.jsx`) |
| Pillow | 12.3.0 | pipeline (`export_map_background.py`, `export_relief_tiles.py`: JPEG and PNG) |

## 5. Derived data and images (not downloaded; no new source)

The files below are generated from the data in section 1 or from NASA SVS images. This section is not in the download table of `download_data.py`.

| File | Origin | Save to | Used for |
|---|---|---|---|
| Relief tiles (5 levels, JPEG) | LOLA DEM `LDEM_80S_80MPP_ADJ` (PGDA 90), same source as D4 | web/public/maps/relief | Terrain background with 500/250 m contour lines (D8b, the Relief layer of W2) |
| Whole-pole overlays: `south_pole_sun.png`, `_earth.png`, `_psr.png`, `_slope.png` | PGDA 69 (Sun, Earth), PGDA 90 `LPSR_80S_20MPP_ADJ` (PSR), PGDA 90 `LDSM_80S_80MPP_ADJ` (slope) | web/public/maps | Layers for % sunlight, % Earth, permanently shadowed regions and slope over the whole pole (D8, `maps.json` entry) |
| CAP 2 km grid (`cap/index.json`, `cap_<tx>_<ty>.json`) | PGDA 90 `LDSM` 80 m, `LPSR` 20 m, `LDEM` 80 m and 240 m; rules of D3, D4 | web/public/data/cap | 2 km cells from 80°S to the pole, outside the 9 regions (D9; E8 extends it from 85°S). Cells whose 2 km frame goes beyond the ±304 km raster are dropped |
| 3D terrain (`<CODE>.bin`, `index.json`) | PGDA 90 `LDEM_80S_80MPP_ADJ` | web/public/terrain | Terrain blocks of the 9 regions for `TerrainView3D.jsx` (D10) |
| `psrDistanceKm` in `cells_<CODE>.json` and `cap/*.json` (E7) | PGDA 90 `LPSR_80S_20MPP_ADJ`, downsampled to ~100 m, keeping only permanently shadowed regions ≥ 1 km² | pipeline/out, web/public/data | Distance from the cell center to the nearest cold trap (`pipeline/compute_science_access.py`). Keeps 2007 polygons ≥ 1 km² at 100 m resolution, versus 1531 PSRs in the PGDA 90 table (the difference comes from merging pixels, not independently checked). Cells less than ~20 km from the 80°S edge may be counted farther than they really are because the mask has no PSR north of 80°S |
| `og-image.png`, `favicon.svg` | `og-image.png` is a screenshot of the app itself (PGDA 90 hillshade background); `favicon.svg` was drawn by the team | web/public | Preview image when sharing the link, tab icon |
| `lroc_color_4k.jpg`, `ldem_bump_1440.png` | NASA SVS 4720 (`lroc_color_16bit_srgb_4k.tif`, `ldem_4_uint.tif`). Page: https://svs.gsfc.nasa.gov/4720. Credit: NASA's Scientific Visualization Studio | web/public/textures | Texture and bump map for the W6 globe (4K color, 1440 px elevation) |

- NASA/JPL DSN Telecommunications Link Design Handbook 810-005, module 301 "Coverage and Geometry", Rev. K (2016): DSN station positions (Table 5) and the 10° elevation limit (sec. 2.2.1, 2.2.4), used by the optional DSN check. https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301K.pdf

## 6. Spacecraft parameters for the built-in presets (E4, `LANDER_PRESETS` in `web/src/core/scenario.js`)

For comparing scenarios only, not official specifications. Any number not found in the source is marked `estimate` in `basis`.

| Preset | Source | Published figures | Estimates |
|---|---|---|---|
| VIPER | https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf | 450 W (angled panel), 5,420 Wh, survives 50 h in power-saving mode | Load 110 W = 5,420 Wh ÷ 50 h |
| Nova-C (IM-1) | https://en.wikipedia.org/wiki/Intuitive_Machines_Nova-C | 200 W, 25 Ah battery on a 28 V bus, designed for 14 days | Battery 700 Wh = 25 Ah × 28 V; load 50 W |
| Blue Ghost 1 | https://fireflyspace.com/missions/blue-ghost-mission-1/ | 400 W, more than 14 days on the surface | Battery 1,400 Wh, load 100 W |
| Vikram (Chandrayaan-3) | https://www.eoportal.org/satellite-missions/chandrayaan-3 (the ISRO brochure link in the plan returns 404) | 738 W, survives 1 lunar day | Battery 2,600 Wh, load 185 W |

## 7. Mission dates and times for Mission Replay (E6, `web/public/data/replay/index.json`)

| Mission | Landing (UTC) | End (UTC) | Source |
|---|---|---|---|
| IM-1 Odysseus | 2024-02-22 23:23 | 2024-02-29, date only (entered standby) | NASA CLPS blog 2024-02-22; Intuitive Machines news release |
| IM-2 Athena | 2025-03-06 about 17:30 | 2025-03-07 06:15 (lander tipped over, battery ran out) | NASA news release 2025-03-07 |
| Chandrayaan-3 (Vikram) | 2023-08-23, date only (the 12:33 UTC time appears only in unofficial sources) | 2023-09-04 02:30 (entered sleep mode) | NASA LRO, PIB, ISRO (pages and X posts, only excerpts readable) |

Short ephemeris for each mission: JPL Horizons, same query as D1, see section 2.
