# References

## Data

- JPL Horizons API — Sun and Earth azimuth/elevation from lunar surface sites. https://ssd.jpl.nasa.gov/api/horizons.api
- NASA GSFC PGDA 90 — LOLA south polar DEM (80 m and 240 m), hillshade, slope (LDSM_80S_80MPP_ADJ) and permanent shadow (LPSR_80S_20MPP_ADJ). https://pgda.gsfc.nasa.gov/products/90
- NASA GSFC PGDA 69 — average Sun and Earth visibility, permanent shadow, 85–90°S (AVGVISIB_85S_060M_201608, LPSR). https://pgda.gsfc.nasa.gov/products/69
- NASA SVS 4720 — CGI Moon Kit color texture (lroc_color_2k.jpg). https://svs.gsfc.nasa.gov/4720
- NASA NTRS 20250011660 — Artemis III candidate landing regions. https://ntrs.nasa.gov/citations/20250011660
- NASA news release (2024-10-28) — NASA Provides Update on Artemis III Moon Landing Regions. https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/
- McClernan, M.T., 2024, Down Selected Artemis III Candidate Landing Site Navigational Grids: U.S. Geological Survey data release. https://doi.org/10.5066/P1MEQ6UK
- McClernan, M.T., Dennis, M.L., Theriot, I.H., Hare, T.M., Archinal, B.A., Ostrach, L.R., Hunter, M.A., Miller, M.J., Beyer, R.A., Annex, A.M., and Lawrence, S.J., 2025, Lunar grid systems, coordinate systems, and map projections for the Artemis missions and lunar surface navigation: U.S. Geological Survey Techniques and Methods, book 11, chap. E1, 308 p. https://doi.org/10.3133/tm11E1
- NASA NTRS 20250009323 — Artemis overview for the 2025 International Space Apps Challenge (HLS slope, lighting and communication needs). https://ntrs.nasa.gov/citations/20250009323
- NASA Space Apps Challenge 2026 — Lunar Landing Site Navigator challenge. https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
- MoonSnag Mission Watch — site registry (approximate Artemis region centres derived from the USGS squares). https://moonsnag.com/coordination
- NASA NSSDCA — Apollo Landing Site Coordinates (Wagner et al. 2017, Icarus 283, 92–103). https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html
- NASA NSSDCA — Table of Anthropogenic Impacts and Spacecraft on the Moon (landed spacecraft coordinates). https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html
- NASA Science Activation — NASA Sees Interns Tackle Real-World Challenges in Lunar Exploration (IM-3 planned mission reference). https://science.nasa.gov/learning-resources/science-activation/nasa-sees-interns-tackle-real-world-challenges-in-lunar-exploration/

## Libraries

- Optional mission chat: Google Gemini structured output — https://aistudio.google.com/docs/structured-output ; Upstash Redis REST/EVAL usage counters — https://upstash.com/docs/redis/features/restapi . Neither is a scientific data source.

- Vite — build tool. https://vite.dev
- React — UI. https://react.dev
- Tailwind CSS — styling. https://tailwindcss.com
- globe.gl — 3D globe. https://github.com/vasturiano/globe.gl
- d3-zoom, d3-selection — pan and zoom for the SVG south-pole map (3.0.0, versions pinned). https://d3js.org/d3-zoom
- Apache ECharts — charts. https://echarts.apache.org
- echarts-for-react — React wrapper for ECharts. https://github.com/hustcc/echarts-for-react
- Astronomy Engine — Sun/Earth positions in the browser. https://github.com/cosinekitty/astronomy
- requests — HTTP client for the data pipeline. https://requests.readthedocs.io
- NumPy — numeric arrays. https://numpy.org
- rasterio — read DEM GeoTIFFs. https://rasterio.readthedocs.io
- pyproj — map projection conversion. https://pyproj4.github.io/pyproj
- GeoPandas — read the USGS LGRS shapefiles. https://geopandas.org
