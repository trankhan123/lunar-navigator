# DATA_SOURCES.md — mọi file dữ liệu, URL và thư viện

Ngày lấy dữ liệu: 2026-11-14. Khi thêm nguồn mới: thêm một dòng ở đây và trong `REFERENCES.md`.

## 1. File tải về (`pipeline/download_data.py` đọc bảng này)

Chạy: `source ~/python/math_env/bin/activate && python pipeline/download_data.py`. File đã có thì bỏ qua.
Link `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/` (thư mục) trả 404, nhưng link tới từng file vẫn tải được.

| File | URL | Lưu vào | Dung lượng | Dùng để |
|---|---|---|---|---|
| LDEM_80S_80MPP_ADJ.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF | pipeline/raw | 180 MB | DEM LOLA 80 m/px, 80–90°S (PGDA 90) → tính đường chân trời |
| LDEM_80S_80MPP_ADJ_HILL.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ_HILL.TIF | pipeline/raw | 84 MB | Hillshade (PGDA 90) → ảnh nền bản đồ cực Nam 2D |
| LDSM_80S_80MPP_ADJ.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDSM_80S_80MPP_ADJ.TIF | pipeline/raw | 231 MB | Độ dốc 80 m/px, 80–90°S (PGDA 90) → module D3 ô khả thi (ngưỡng 20°) |
| LPSR_80S_20MPP_ADJ.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LPSR_80S_20MPP_ADJ.TIF | pipeline/raw | 148 MB | Vùng tối vĩnh cửu 20 m/px, 80–90°S (PGDA 90) → module D3 |
| LDEM_60S_240MPP_ADJ.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF | pipeline/raw | 210 MB | DEM 240 m/px, 60–90°S (PGDA 90) → module D4 phần chân trời xa ngoài 80°S, site như Chandrayaan-3 |
| AVGVISIB_85S_060M_201608.TIF | https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608.TIF | pipeline/raw | 32 MB | % thời gian thấy Mặt Trời, 85–90°S (PGDA 69) → kiểm chứng + lớp phủ bản đồ |
| AVGVISIB_85S_060M_201608_EARTH.TIF | https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608_EARTH.TIF | pipeline/raw | 24 MB | % thời gian thấy Trái Đất (PGDA 69) → kiểm chứng |
| LPSR_85S_060M_201608.TIF | https://pgda.gsfc.nasa.gov/data/MoonIllumination/LPSR_85S_060M_201608.TIF | pipeline/raw | 0.6 MB | Vùng tối vĩnh cửu (PGDA 69) → tính năng phụ "viền vùng tối vĩnh cửu" |
| lroc_color_2k.jpg | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg | web/public/textures | 0.4 MB | Texture Mặt Trăng cho globe.gl (NASA SVS 4720, CGI Moon Kit) |

Trang gốc: PGDA 90 https://pgda.gsfc.nasa.gov/products/90 · PGDA 69 https://pgda.gsfc.nasa.gov/products/69 · SVS 4720 https://svs.gsfc.nasa.gov/4720

## 2. API

| Nguồn | URL | Dùng để |
|---|---|---|
| JPL Horizons API (ephemeris) | https://ssd.jpl.nasa.gov/api/horizons.api | Module D1: `COMMAND=301`, `CENTER=500@399`, `QUANTITIES=14,15,19,20`, bước 1h, 2027-01-01 → 2029-01-31, chia theo quý → `web/public/data/ephemeris.json`. Cache vào `pipeline/raw/horizons/` |
| JPL Horizons API (kiểm chứng) | https://ssd.jpl.nasa.gov/api/horizons.api | Azimuth/elevation Mặt Trời (`COMMAND=10`) và Trái Đất (`COMMAND=399`) tại điểm (`CENTER=coord@301`, `QUANTITIES=4`) → fixture `web/src/core/fixtures/horizons_check.json`. Bước 1h OK, 1 tháng = 745 dòng |

## 3. Toạ độ site (`pipeline/sites.json`, không bịa)

NASA chỉ công bố tên và bản đồ của 9 vùng Artemis III, không công bố toạ độ số. Toạ độ hiện dùng lấy từ các nguồn sau:

| Nguồn | URL | Dùng cho |
|---|---|---|
| NTRS 20250011660 — Artemis III Site Selection Update (danh sách 9 vùng, không có toạ độ) | https://ntrs.nasa.gov/citations/20250011660 | Tên vùng |
| NASA news release 2024-10-28 — NASA Provides Update on Artemis III Moon Landing Regions | https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ | Tên vùng, bản đồ |
| USGS data release, McClernan 2024 — Down Selected Artemis III Candidate Landing Site Navigational Grids (ScienceBase item 671a6fa8d34efed5620f89f8) | https://doi.org/10.5066/P1MEQ6UK | Ô vuông vùng (nguồn gốc của tâm vùng) và **shapefile lưới LGRS ACC 1 km của 9 vùng cho module D2**. Phải tải bằng trình duyệt vào `pipeline/raw/lgrs/` (script bị 403) |
| USGS Techniques and Methods 11-E1 (2025) — Lunar grid systems, coordinate systems, and map projections for the Artemis missions and lunar surface navigation | https://doi.org/10.3133/tm11E1 | Thiết kế LGRS, LPS, Artemis Condensed Coordinates (đọc để hiểu nhãn ô) |
| USGS Astropedia — Lunar Map Projections and Grid Reference System (doi:10.5066/P1SZQZDB, 12,5 GB, toàn cầu) | https://astrogeology.usgs.gov/search/map/lunar-map-projections-and-grid-reference-system-for-artemis-astronaut-surface-navigation | Không dùng (quá lớn); chỉ ghi để tra cứu |
| NASA NTRS 20250009323 — Artemis overview for Space Apps 2025 (HLS: ngưỡng độ dốc, chiếu sáng, liên lạc) | https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf | Ngưỡng độ dốc 20° của module D3 |
| MoonSnag Mission Watch site registry (tâm ô vuông USGS) | https://moonsnag.com/coordination | Toạ độ 9 vùng, `verified: false` |
| realestateonthemoon.com (trích NASA Lunar Surface Data Book) | https://realestateonthemoon.com/lunar-south-pole/ | Chỉ để đối chiếu |
| NASA NSSDCA Apollo Landing Site Coordinates (Wagner et al. 2017) | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html | Apollo 11, 12, 14, 15, 16, 17, `verified: true` |
| NASA NSSDCA Table of Anthropogenic Impacts and Spacecraft on the Moon | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html | IM-1, IM-2, Blue Ghost 1, Chang'e 3–6, Chandrayaan-3, SLIM, `verified: true` |
| NASA Science Activation — NASA Sees Interns Tackle Real-World Challenges in Lunar Exploration | https://science.nasa.gov/learning-resources/science-activation/nasa-sees-interns-tackle-real-world-challenges-in-lunar-exploration/ | IM-3 (sứ mệnh dự kiến tới Reiner Gamma, chưa có toạ độ xác nhận) |

## 4. Thư viện

| Thư viện | Phiên bản | Dùng ở |
|---|---|---|
| requests | 2.34.2 | pipeline |
| numpy | 2.5.4 | pipeline |
| rasterio | 1.5.2 | pipeline |
| pyproj | 3.8.0 | pipeline |
| geopandas (kéo theo pyogrio 0.13.0, shapely 2.2.0, pandas) | 1.2.0 | pipeline, module D2 đọc shapefile LGRS |
| vite | 8.3.x | web |
| react, react-dom | 19.3.x | web |
| tailwindcss, @tailwindcss/vite | 4.3.5 | web |
| globe.gl | 2.46.2 | web |
| d3-zoom, d3-selection (every d3 package, globe.gl's included, pinned with `overrides` in web/package.json to its release before 2026-11-03) | 3.0.0 | web (components/SouthPoleMap.jsx) |
| echarts | 6.1.0 | web |
| echarts-for-react | 3.0.6 | web |
| astronomy-engine | 2.1.19 | web (`src/astronomy.js`) |
