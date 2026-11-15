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
| LPSR_80S_20MPP_ADJ.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LPSR_80S_20MPP_ADJ.TIF | pipeline/raw | 148 MB | Vùng tối vĩnh cửu 20 m/px, 80–90°S (PGDA 90) → module D3 + lớp phủ bản đồ (D8) |
| LDEM_60S_240MPP_ADJ.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF | pipeline/raw | 210 MB | DEM 240 m/px, 60–90°S (PGDA 90) → module D4 phần chân trời xa ngoài 80°S, site như Chandrayaan-3 |
| AVGVISIB_85S_060M_201608.TIF | https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608.TIF | pipeline/raw | 32 MB | % thời gian thấy Mặt Trời, 85–90°S (PGDA 69) → kiểm chứng + lớp phủ bản đồ. D7 so sánh: trung bình các pixel 60 m trong mỗi ô 1 km, 240 ô mẫu (8 vùng × 30) |
| AVGVISIB_85S_060M_201608_EARTH.TIF | https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608_EARTH.TIF | pipeline/raw | 24 MB | % thời gian thấy Trái Đất (PGDA 69) → kiểm chứng + lớp phủ bản đồ (D8). D7 so sánh: trung bình các pixel 60 m trong mỗi ô 1 km, 240 ô mẫu (8 vùng × 30) |
| LPSR_85S_060M_201608.TIF | https://pgda.gsfc.nasa.gov/data/MoonIllumination/LPSR_85S_060M_201608.TIF | pipeline/raw | 0.6 MB | Vùng tối vĩnh cửu (PGDA 69) → tính năng phụ "viền vùng tối vĩnh cửu" |
| lroc_color_2k.jpg | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg | web/public/textures | 0.4 MB | Texture Mặt Trăng cho globe.gl (NASA SVS 4720, CGI Moon Kit) |

Trang gốc: PGDA 90 https://pgda.gsfc.nasa.gov/products/90 · PGDA 69 https://pgda.gsfc.nasa.gov/products/69 · SVS 4720 https://svs.gsfc.nasa.gov/4720

## 2. API

Optional chat only: Google Gemini API (https://aistudio.google.com/docs/structured-output)
extracts form parameters; Upstash Redis REST (https://upstash.com/docs/redis/features/restapi)
stores usage counters. Neither supplies scientific results or new lunar data.

| Nguồn | URL | Dùng để |
|---|---|---|
| JPL Horizons API (ephemeris) | https://ssd.jpl.nasa.gov/api/horizons.api | Module D1: `COMMAND=301`, `CENTER=500@399`, `QUANTITIES=14,15,19,20`, bước 1h, 2027-01-01 → 2029-01-31, chia theo quý → `web/public/data/ephemeris.json`. Cache vào `pipeline/raw/horizons/` |
| JPL Horizons API (kiểm chứng) | https://ssd.jpl.nasa.gov/api/horizons.api | Azimuth/elevation Mặt Trời (`COMMAND=10`) và Trái Đất (`COMMAND=399`) tại điểm (`CENTER=coord@301`, `QUANTITIES=4`) → fixture `web/src/core/fixtures/horizons_check.json`. Bước 1h OK, 1 tháng = 745 dòng |
| JPL Horizons API (trạm DSN - Task 11) | https://ssd.jpl.nasa.gov/api/horizons.api | Góc cao biểu kiến của Mặt Trăng (`COMMAND=301`) nhìn từ 3 trạm DSN trên Trái Đất (`CENTER=coord@399`, `QUANTITIES=4`: Goldstone DSS-14, Madrid DSS-63, Canberra DSS-43), bước 1h, 2027-01-01 → 2029-01-31 (18.288h) → `web/public/data/dsn.json` (đơn vị 0.1°). Cache vào `pipeline/raw/horizons_dsn/` |
| JPL Horizons API (Mission Replay - E6) | https://ssd.jpl.nasa.gov/api/horizons.api | Cùng tham số với D1 (`COMMAND=301`, `CENTER=500@399`, `QUANTITIES=14,15,19,20`, bước 1h), 3 khung ngắn quanh ngày hạ cánh thật của IM-1, IM-2, Chandrayaan-3 → `web/public/data/replay/<siteId>.json` (`pipeline/fetch_replay.py`). Cache vào `pipeline/raw/horizons/` |

## 3. Toạ độ site (`pipeline/sites.json`, không bịa)

NASA chỉ công bố tên và bản đồ của 9 vùng Artemis III, không công bố toạ độ số. Toạ độ hiện dùng lấy từ các nguồn sau:

| Nguồn | URL | Dùng cho |
|---|---|---|
| NTRS 20250011660 — Artemis III Site Selection Update (danh sách 9 vùng, không có toạ độ) | https://ntrs.nasa.gov/citations/20250011660 | Tên vùng |
| NASA news release 2024-10-28 — NASA Provides Update on Artemis III Moon Landing Regions | https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ | Tên vùng, bản đồ |
| USGS data release, McClernan 2024 — Down Selected Artemis III Candidate Landing Site Navigational Grids (ScienceBase item 671a6fa8d34efed5620f89f8) | https://doi.org/10.5066/P1MEQ6UK | Ô vuông vùng (nguồn gốc của tâm vùng) và **shapefile lưới LGRS ACC 1 km của 9 vùng cho module D2**. Phải tải bằng trình duyệt vào `pipeline/raw/lgrs/` (script bị 403) |
| USGS Techniques and Methods 11-E1 (2025) — Lunar grid systems, coordinate systems, and map projections for the Artemis missions and lunar surface navigation | https://doi.org/10.3133/tm11E1 | Thiết kế LGRS, LPS, Artemis Condensed Coordinates (đọc để hiểu nhãn ô) |
| USGS data release — Artemis III candidate landing site navigational grids, 13 vùng gốc năm 2022 và Apollo 11–17 (ScienceBase item 67168797d34ebf903f48b6fc) | https://doi.org/10.5066/P13FD9ZD | **Chưa dùng.** Dành cho E9 (thêm Peak near Shackleton, Connecting Ridge… ở lưới 1 km). Tải bằng trình duyệt vào `pipeline/raw/lgrs/` |
| USGS data release — lưới LGRS toàn cầu, phép chiếu LTM/LPS | https://doi.org/10.5066/P13YPWQD | **Chưa dùng.** Dành cho E10 (lớp lưới 25 km và nhãn ô). Tải bằng trình duyệt vào `pipeline/raw/lgrs_global/` |
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
| three | 0.187.0 (ghim chính xác; globe.gl dùng cùng bản) | web (`components/TerrainView3D.jsx`) |
| Pillow | chưa ghi trong `pipeline/requirements.txt` | pipeline (`export_map_background.py`, `export_relief_tiles.py`: JPEG và PNG) |

## 5. Dữ liệu dẫn xuất và ảnh (không tải; không có nguồn mới)

Các file dưới đây được sinh từ dữ liệu ở mục 1 hoặc từ ảnh NASA SVS. Mục này không nằm trong bảng tải của `download_data.py`.

| File | Nguồn gốc | Lưu vào | Dùng để |
|---|---|---|---|
| Relief tiles (5 mức, JPEG) | LOLA DEM `LDEM_80S_80MPP_ADJ` (PGDA 90), cùng nguồn với D4 | web/public/maps/relief | Nền địa hình có đường đồng mức 500/250 m (D8b, lớp Relief của W2) |
| Lớp phủ toàn cực: `south_pole_sun.png`, `_earth.png`, `_psr.png`, `_slope.png` | PGDA 69 (Sun, Earth), PGDA 90 `LPSR_80S_20MPP_ADJ` (PSR), PGDA 90 `LDSM_80S_80MPP_ADJ` (slope) | web/public/maps | Lớp % nắng, % Trái Đất, vùng tối vĩnh cửu, độ dốc trên toàn cực (D8, mục `maps.json`) |
| Lưới CAP 2 km (`cap/index.json`, `cap_<tx>_<ty>.json`) | PGDA 90 `LDSM` 80 m, `LPSR` 20 m, `LDEM` 80 m và 240 m; quy tắc của D3, D4 | web/public/data/cap | Ô 2 km từ 80°S tới cực, ngoài 9 vùng (D9; E8 mở rộng từ 85°S). Ô có khung 2 km vượt ra ngoài raster ±304 km bị bỏ |
| Địa hình 3D (`<CODE>.bin`, `index.json`) | PGDA 90 `LDEM_80S_80MPP_ADJ` | web/public/terrain | Khối địa hình 9 vùng cho `TerrainView3D.jsx` (D10) |
| `psrDistanceKm` trong `cells_<CODE>.json` và `cap/*.json` (E7) | PGDA 90 `LPSR_80S_20MPP_ADJ`, hạ xuống ~100 m, chỉ giữ vùng tối vĩnh cửu ≥ 1 km² | pipeline/out, web/public/data | Khoảng cách từ tâm ô tới bẫy lạnh gần nhất (`pipeline/compute_science_access.py`). Giữ 2007 đa giác ≥ 1 km² ở độ phân giải 100 m, so với 1531 PSR trong bảng PGDA 90 (khác do gộp pixel, chưa kiểm độc lập). Ô cách mép 80°S dưới ~20 km có thể bị tính xa hơn thực tế vì mask không có PSR phía bắc 80°S |
| `lroc_color_4k.jpg`, `ldem_bump_1440.png` | NASA SVS 4720 (`lroc_color_16bit_srgb_4k.tif`, `ldem_4_uint.tif`). Trang: https://svs.gsfc.nasa.gov/4720. Credit: NASA's Scientific Visualization Studio | web/public/textures | Texture và bump cho quả cầu W6 (4K màu, 1440 px độ cao) |

- NASA/JPL DSN Telecommunications Link Design Handbook 810-005, module 301 "Coverage and Geometry", Rev. K (2016): DSN station positions (Table 5) and the 10° elevation limit (sec. 2.2.1, 2.2.4), used by the optional DSN check. https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301K.pdf

## 6. Thông số tàu cho mẫu có sẵn (E4, `LANDER_PRESETS` trong `web/src/core/scenario.js`)

Chỉ để so sánh kịch bản, không phải thông số chính thức. Số nào không có trong nguồn thì ghi `estimate` trong `basis`.

| Mẫu | Nguồn | Số công bố | Số ước tính |
|---|---|---|---|
| VIPER | https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf | 450 W (tấm góc), 5.420 Wh, sống 50 h ở chế độ tiết kiệm | Tải 110 W = 5.420 Wh ÷ 50 h |
| Nova-C (IM-1) | https://en.wikipedia.org/wiki/Intuitive_Machines_Nova-C | 200 W, pin 25 Ah trên bus 28 V, thiết kế 14 ngày | Pin 700 Wh = 25 Ah × 28 V; tải 50 W |
| Blue Ghost 1 | https://fireflyspace.com/missions/blue-ghost-mission-1/ | 400 W, hơn 14 ngày trên bề mặt | Pin 1.400 Wh, tải 100 W |
| Vikram (Chandrayaan-3) | https://www.eoportal.org/satellite-missions/chandrayaan-3 (link brochure ISRO trong kế hoạch trả 404) | 738 W, sống 1 ngày Mặt Trăng | Pin 2.600 Wh, tải 185 W |

## 7. Ngày giờ sứ mệnh cho Mission Replay (E6, `web/public/data/replay/index.json`)

| Sứ mệnh | Hạ cánh (UTC) | Kết thúc (UTC) | Nguồn |
|---|---|---|---|
| IM-1 Odysseus | 2024-02-22 23:23 | 2024-02-29, chỉ có ngày (vào chế độ chờ) | NASA CLPS blog 2024-02-22; Intuitive Machines news release |
| IM-2 Athena | 2025-03-06 khoảng 17:30 | 2025-03-07 06:15 (tàu nằm nghiêng, hết pin) | NASA news release 2025-03-07 |
| Chandrayaan-3 (Vikram) | 2023-08-23, chỉ có ngày (giờ 12:33 UTC chỉ thấy trên nguồn không chính thức) | 2023-09-04 02:30 (vào chế độ ngủ) | NASA LRO, PIB, ISRO (trang và bài đăng X, chỉ đọc được đoạn trích) |

Lịch thiên văn ngắn cho từng sứ mệnh: JPL Horizons, cùng truy vấn với D1, xem mục 2.

