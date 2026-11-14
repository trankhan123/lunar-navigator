# DATA_SOURCES.md — mọi file dữ liệu, URL và thư viện

Ngày lấy dữ liệu: 2026-11-14. Khi thêm nguồn mới: thêm một dòng ở đây và trong `REFERENCES.md`.

## 1. File tải về (`pipeline/download_data.py` đọc bảng này)

Chạy: `source ~/python/math_env/bin/activate && python pipeline/download_data.py`. File đã có thì bỏ qua.
Link `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/` (thư mục) trả 404, nhưng link tới từng file vẫn tải được.

| File | URL | Lưu vào | Dung lượng | Dùng để |
|---|---|---|---|---|
| LDEM_80S_80MPP_ADJ.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF | pipeline/raw | 180 MB | DEM LOLA 80 m/px, 80–90°S (PGDA 90) → tính đường chân trời |
| LDEM_80S_80MPP_ADJ_HILL.TIF | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ_HILL.TIF | pipeline/raw | 84 MB | Hillshade (PGDA 90) → ảnh nền bản đồ cực Nam 2D |
| AVGVISIB_85S_060M_201608.TIF | https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608.TIF | pipeline/raw | 32 MB | % thời gian thấy Mặt Trời, 85–90°S (PGDA 69) → kiểm chứng + lớp phủ bản đồ |
| AVGVISIB_85S_060M_201608_EARTH.TIF | https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608_EARTH.TIF | pipeline/raw | 24 MB | % thời gian thấy Trái Đất (PGDA 69) → kiểm chứng |
| LPSR_85S_060M_201608.TIF | https://pgda.gsfc.nasa.gov/data/MoonIllumination/LPSR_85S_060M_201608.TIF | pipeline/raw | 0.6 MB | Vùng tối vĩnh cửu (PGDA 69) → tính năng phụ "viền vùng tối vĩnh cửu" |
| lroc_color_2k.jpg | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg | web/public/textures | 0.4 MB | Texture Mặt Trăng cho globe.gl (NASA SVS 4720, CGI Moon Kit) |

Trang gốc: PGDA 90 https://pgda.gsfc.nasa.gov/products/90 · PGDA 69 https://pgda.gsfc.nasa.gov/products/69 · SVS 4720 https://svs.gsfc.nasa.gov/4720

## 2. API

| Nguồn | URL | Dùng để |
|---|---|---|
| JPL Horizons API | https://ssd.jpl.nasa.gov/api/horizons.api | Azimuth/elevation Mặt Trời (`COMMAND=10`) và Trái Đất (`COMMAND=399`) tại site. Bước 1h OK, 1 tháng = 745 dòng. Cache vào `pipeline/raw/horizons/` |

## 3. Toạ độ site (`pipeline/sites.json`, không bịa)

NASA chỉ công bố tên và bản đồ của 9 vùng Artemis III, không công bố toạ độ số. Toạ độ hiện dùng lấy từ các nguồn sau:

| Nguồn | URL | Dùng cho |
|---|---|---|
| NTRS 20250011660 — Artemis III Site Selection Update (danh sách 9 vùng, không có toạ độ) | https://ntrs.nasa.gov/citations/20250011660 | Tên vùng |
| NASA news release 2024-10-28 — NASA Provides Update on Artemis III Moon Landing Regions | https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ | Tên vùng, bản đồ |
| USGS data release, McClernan 2024 — Down Selected Artemis III Candidate Landing Site Navigational Grids | https://doi.org/10.5066/P1MEQ6UK | Ô vuông vùng (nguồn gốc của tâm vùng) |
| MoonSnag Mission Watch site registry (tâm ô vuông USGS) | https://moonsnag.com/coordination | Toạ độ 9 vùng, `verified: false` |
| realestateonthemoon.com (trích NASA Lunar Surface Data Book) | https://realestateonthemoon.com/lunar-south-pole/ | Chỉ để đối chiếu |
| NASA NSSDCA Apollo Landing Site Coordinates (Wagner et al. 2017) | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html | Apollo 11, 15, 17, `verified: true` |

## 4. Thư viện

| Thư viện | Phiên bản | Dùng ở |
|---|---|---|
| requests | 2.34.2 | pipeline |
| numpy | 2.5.4 | pipeline |
| rasterio | 1.5.2 | pipeline |
| pyproj | 3.8.0 | pipeline |
| vite | 8.3.x | web |
| react, react-dom | 19.3.x | web |
| tailwindcss, @tailwindcss/vite | 4.3.5 | web |
| globe.gl | 2.46.2 | web |
| echarts | 6.1.0 | web |
| echarts-for-react | 3.0.6 | web |
| astronomy-engine | 2.1.19 | web (`src/astronomy.js`) |
