# CLAUDE.md — Lunar Landing Site Navigator (NASA Space Apps 2026)

File này là bối cảnh cố định cho Claude Code. Đọc hết trước khi làm bất kỳ việc gì.
Danh sách mọi file dữ liệu, URL và thư viện nằm trong `DATA_SOURCES.md`: đọc cả file đó.

## 1. Bối cảnh

- Cuộc thi: NASA Space Apps Challenge 2026, đề **Lunar Landing Site Navigator**.
- Thời gian: 14–15/11/2026. Hạn nộp: **23:59 ngày 15/11 giờ Việt Nam**. Mục tiêu nộp sớm vài giờ.
- Người dùng mục tiêu của đề: mission planner, nhà giáo dục, công chúng.
- Yêu cầu cốt lõi của đề: hiển thị **Mặt Trời và Trái Đất so với đường chân trời** tại một điểm đổ bộ theo thời gian, để đánh giá cửa sổ phát điện (pin mặt trời) và cửa sổ liên lạc direct-to-Earth; so sánh nhanh site khác hoặc ngày khác khi lịch sứ mệnh bị trượt.
- Đề nhắc hai lần: hiển thị **còn bao lâu đến lúc Mặt Trời lặn / Trái Đất lặn**. Đây là thành phần phải nổi bật.
- Mặt Trăng không có khí quyển nên không có khúc xạ; chân trời do địa hình và độ cong mặt cầu quyết định. Libration đã được Horizons tính sẵn.
- Nhóm muốn thêm phần **sạc năng lượng** (mô phỏng pin, xem mục 7).

Câu định vị sản phẩm: *"Pick a site and a date, see when your lander can charge and call home — and what happens if launch slips."*

## 2. Tech stack (đã chốt, không đổi)

| Phần | Công nghệ |
|---|---|
| Tiền xử lý dữ liệu | Python 3.11+, `requests`, `numpy`, `rasterio`, `pyproj` |
| Web | Vite + React (**JavaScript, không dùng TypeScript**) |
| Quả cầu 3D | `globe.gl` (không dùng three.js thuần, không Blender/Unity) |
| Biểu đồ | ECharts (`echarts` + `echarts-for-react`) |
| CSS | Tailwind |
| Thiên văn trong trình duyệt | `astronomy-engine` (vị trí Mặt Trời/Trái Đất cho toạ độ tuỳ ý và thời gian thực) |
| Deploy | Vercel, web tĩnh, không backend |

Không thêm thư viện ngoài danh sách nếu chưa hỏi. Không dùng React Router: chuyển màn hình bằng state/tab.

## 3. Kiến trúc: tính trước, phục vụ tĩnh

```
[Python, chạy trên máy, một lần]
  JPL Horizons API ──┐
  DEM LOLA (PGDA 90)─┼─> pipeline/ ─> web/public/data/*.json
  PGDA 69 (kiểm chứng)┘
[Vercel]
  web/  ─> trình duyệt fetch("/data/<site_id>.json") và vẽ
  astronomy-engine trong trình duyệt ─> toạ độ tuỳ ý, đồng hồ "now"
```

- Site có sẵn: luôn dùng JSON tính trước. Không gọi Horizons từ trình duyệt cho site có sẵn.
- Toạ độ tuỳ ý và chế độ "now": tính Mặt Trời/Trái Đất ngay trong trình duyệt bằng `astronomy-engine`, dùng chân trời mặt cầu (góc cao > 0°) nếu site không có địa hình. Cách tính ở mục 6.
- Horizons vẫn là nguồn chính cho site có sẵn và là chuẩn để kiểm chứng astronomy-engine.

Cấu trúc thư mục:

```
lunar-navigator/
  CLAUDE.md
  REFERENCES.md        # mọi nguồn dữ liệu, thư viện, ảnh
  AI_USAGE.md          # ghi lại AI được dùng ở đâu, làm gì (luật cuộc thi bắt buộc)
  DATA_SOURCES.md      # danh sách file dữ liệu, URL, ngày lấy
  pipeline/
    download_data.py   # tải các file trong DATA_SOURCES.md mục 1
    raw/               # DEM, TIF nặng — CÓ TRONG .gitignore
    sites.json         # danh sách site + toạ độ
    fetch_horizons.py
    compute_horizon.py
    build_site_data.py # gộp mọi thứ, xuất JSON vào web/public/data/
    validate.py        # so sánh với PGDA 69
  web/
    public/data/
    src/
    src/astronomy.js   # Mặt Trời/Trái Đất bằng astronomy-engine
```

## 4. Data contract (Python ↔ web)

`web/public/data/sites.json` — danh sách để hiện trên quả cầu:

```json
[{ "id": "haworth", "name": "Haworth", "lat": 0, "lon": 0, "group": "artemis", "hasTerrain": true }]
```

`web/public/data/<id>.json` — dữ liệu từng site:

```json
{
  "id": "haworth",
  "name": "Haworth",
  "lat": 0, "lon": 0,
  "mastHeight": 2,
  "horizon": [0.0],
  "startTime": "2028-01-01T00:00Z",
  "stepHours": 1,
  "sun":   [[0.0, 0.0]],
  "earth": [[0.0, 0.0]],
  "sunVisible":   [0.0],
  "earthVisible": [0.0],
  "check": { "sunPercentPGDA": null, "earthPercentPGDA": null }
}
```

- `horizon`: 360 số, góc cao chân trời (độ) tại phương vị 0°…359°.
- `sun`, `earth`: cặp `[azimuth, elevation]` (độ) theo từng bước thời gian. Thời gian của phần tử i = `startTime + i * stepHours`.
- `sunVisible`, `earthVisible`: tỉ lệ đĩa lộ ra trên chân trời, 0…1.
- Làm tròn 2 chữ số thập phân để file nhỏ. Tên file và `id` viết thường, không dấu cách (Vercel phân biệt hoa thường).
- Các chỉ số (% nắng, khoảng tối dài nhất…) **tính ở trình duyệt** từ chuỗi trên, để người dùng đổi khoảng ngày được.

## 5. Dữ liệu và nguồn

**JPL Horizons API** (đã gọi thử thành công):

```
https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=10&OBJ_DATA=NO&CENTER=coord@301&SITE_COORD=0,-86,0&START_TIME=2026-11-14&STOP_TIME=2026-12-14&STEP_SIZE=1d&QUANTITIES=4
```

- `COMMAND=10` Mặt Trời, `COMMAND=399` Trái Đất. `SITE_COORD` = kinh độ Đông (độ), vĩ độ (độ), độ cao (km).
- Cột kết quả: azimuth tính theo chiều kim đồng hồ từ hướng Bắc; elevation so với mặt cầu 1737,4 km, chưa tính địa hình.
- Bước `1h` đã thử OK (14/11): 1 tháng = 745 dòng. Chia request theo từng tháng để tránh giới hạn số dòng. Cache kết quả thô vào `pipeline/raw/horizons/` để không gọi lại.
- Khoảng thời gian mặc định: cả năm 2028 (Artemis IV dự kiến đầu 2028). Để dạng tham số.

**DEM và sản phẩm chiếu sáng (NASA GSFC PGDA):**

| Sản phẩm | File | Dùng để |
|---|---|---|
| PGDA 90 | `LDEM_80S_80MPP_ADJ.TIF` (80 m/px, 80–90°S, south polar stereographic, độ cao tính bằng mét) — https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/ | tính đường chân trời |
| PGDA 69 | `AVGVISIB_85S_060M_201608.TIF`, `..._EARTH.TIF` — https://pgda.gsfc.nasa.gov/data/MoonIllumination/ | kiểm chứng % nắng, % thấy Trái Đất |
| NASA SVS 4720 | texture Mặt Trăng cho globe.gl — https://svs.gsfc.nasa.gov/4720 | chỉ để hiển thị |

DEM chỉ phủ 80–90°S. Site ngoài vùng này (Apollo…) dùng chân trời mặt cầu và đặt `hasTerrain: false`.

**Site có sẵn:**

- 9 vùng ứng viên Artemis: Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain.
- Vài site Apollo để so sánh (không có địa hình).
- **KHÔNG tự bịa toạ độ.** Để `lat`/`lon` là `null` kèm `"source": "TODO"` trong `pipeline/sites.json`; nhóm sẽ điền từ nguồn NASA (NTRS 20250011660, trang Artemis). Code phải bỏ qua site có toạ độ `null` và in cảnh báo. **Cập nhật 14/11:** NASA không công bố toạ độ số; đã điền toạ độ có nguồn vào `pipeline/sites.json` (9 vùng Artemis `verified: false`, 3 Apollo `verified: true`), chi tiết ở `DATA_SOURCES.md` mục 3.

## 6. Thuật toán lõi

**Đường chân trời địa hình** (`compute_horizon.py`):

1. Đọc DEM bằng `rasterio`, lấy CRS từ file, đổi (x, y) → (lat, lon) bằng `pyproj`.
2. Chỉ lấy pixel trong bán kính ~200 km quanh site (xa hơn thì độ cong Mặt Trăng làm cả núi cao 7 km cũng chìm dưới mặt phẳng ngang; phần nào ra ngoài vùng DEM 80–90°S thì bỏ qua và ghi chú) (có thể lấy mẫu thưa hơn ở xa để chạy nhanh).
3. Đổi mỗi điểm sang 3D gắn với Mặt Trăng: `r = 1737400 + height`, `(r·cosLat·cosLon, r·cosLat·sinLon, r·sinLat)`.
4. Vị trí quan sát = độ cao DEM tại site + `mastHeight` (mặc định 2 m, cho chọn 10 m).
5. Chiếu vector (điểm − quan sát) vào hệ East-North-Up của site → azimuth (chiều kim đồng hồ từ Bắc) và góc cao.
6. Với mỗi ô azimuth 1°, lấy góc cao lớn nhất → mảng 360 số.

**Nhìn thấy:** nội suy góc chân trời tại azimuth của vật thể. Bán kính đĩa: Mặt Trời ≈ 0,27°, Trái Đất ≈ 0,95°. Tỉ lệ đĩa lộ ra = phần đĩa nằm trên chân trời (xấp xỉ tuyến tính theo khoảng cách tâm–chân trời là đủ).

**Chỉ số (tính trong web, theo khoảng ngày đang chọn):**

- Góc cao Mặt Trời hiện tại; % thời gian có nắng; % thấy Trái Đất; % có cả hai.
- Khoảng tối liên tục dài nhất; khoảng mất liên lạc dài nhất.
- **Đếm ngược**: thời gian đến lần Mặt Trời lặn / Trái Đất lặn tiếp theo (hoặc mọc, nếu đang khuất).

**Mặt Trời/Trái Đất trong trình duyệt** (`web/src/astronomy.js`):

1. `astronomy-engine`: vector Trái Đất→Mặt Trăng (`GeoMoon`) và Trái Đất→Mặt Trời (`GeoVector(Body.Sun)`), hệ EQJ.
2. Mặt Trăng→Mặt Trời = Sun − Moon; Mặt Trăng→Trái Đất = −Moon.
3. Xoay sang hệ gắn với Mặt Trăng bằng `RotationAxis(Body.Moon, time)` (ra, dec, spin theo IAU).
4. Chiếu vào East-North-Up của site → azimuth, elevation.
5. Viết test so với Horizons tại 3 site × 5 thời điểm; sai lệch mục tiêu < 0,1°. Ghi kết quả vào `AI_USAGE.md`/README. Nếu lệch lớn, chỉ dùng Horizons.

**Kiểm chứng** (`validate.py`): so % nắng và % thấy Trái Đất tự tính với giá trị pixel PGDA 69 tại site (PGDA là trung bình nhiều năm nên chỉ cần cùng xu hướng, sai lệch vài % là chấp nhận được). Ghi kết quả vào `check` trong JSON và hiện trên giao diện ("Validated against NASA PGDA").

## 7. Tính năng năng lượng / sạc pin

Mô phỏng pin theo từng giờ cho một lander, các tham số người dùng chỉnh được:

- Diện tích pin mặt trời (m²), hiệu suất (mặc định 0,3), dung lượng pin (kWh), công suất tiêu thụ (W).
- Công suất phát mỗi giờ = `1361 × diện tích × hiệu suất × sunVisible`. Giả định panel đứng, xoay theo Mặt Trời (ở cực Mặt Trời luôn sát chân trời). Ghi rõ giả định này trên giao diện.
- Mức pin: `battery = min(capacity, battery + (power − load) × 1h)`; nếu < 0 thì đánh dấu "lander dead" tại thời điểm đó.

Kết quả hiển thị:

- Biểu đồ mức pin theo thời gian, tô các khoảng đang sạc.
- **Dung lượng pin tối thiểu để sống qua khoảng tối dài nhất** của site và khoảng ngày đang chọn.
- Gợi ý "cửa sổ sạc đầy" trước mỗi lần Mặt Trời lặn.

## 8. Giao diện

Tất cả chữ trên giao diện bằng **tiếng Anh**. Chạy tốt trên laptop, dùng được trên điện thoại.

Ưu tiên theo thứ tự:

1. **Globe** (globe.gl): chọn site bằng cách bấm điểm trên quả cầu hoặc chọn từ danh sách.
2. **Horizon view** (ECharts): trục x là azimuth 0–360°, trục y là góc cao; vùng tô màu là địa hình; chấm Mặt Trời và Trái Đất tại thời điểm đang chọn.
3. **Timeline + countdown**: thanh trượt thời gian, nút play; dải màu nắng / thấy Trái Đất; đồng hồ đếm ngược đến sunset / Earthset to, nổi bật.
4. **Metrics card**: các chỉ số ở mục 6.
5. **Compare**: hai kịch bản (site A ngày X vs site B ngày Y) cạnh nhau.
6. **Launch slip**: thanh "delay N days" → chỉ số thay đổi ra sao. Thêm calendar heatmap site × ngày hạ cánh (màu = điểm tốt/xấu cho ở lại 6 ngày).
7. **Energy panel**: mục 7.
8. **Simple / Expert mode**: Simple ẩn số liệu kỹ thuật, dùng câu chữ dễ hiểu ("Sun sets in 3 days 4 h"); Expert hiện đủ góc và bảng.

Chi tiết học từ navlunar.com (chỉ lấy ý tưởng, không dùng code của họ):

- **Câu tóm tắt bằng lời** ở đầu mỗi site, ví dụ: "It is night at Haworth. Sunrise in about 4 days, at 2028-01-17 10:31 UTC. Earth is visible for the next 9 days." Đây là phần chính của Simple mode.
- **Horizon view kiểu panorama**: ghi chú "Vertical scale exaggerated 3×", độ cao mắt quan sát, khoảng cách tới đỉnh núi che; vẽ cả **Mặt Trời và Trái Đất** (đây là điểm khác biệt, nhiều công cụ chỉ vẽ Mặt Trời).
- **Minh bạch**: mỗi màn hình có dòng nhỏ "Terrain resolution: 80 m. Data: NASA LOLA (PGDA 90), JPL Horizons." và trang About có mục Known limitations.
- **Link chia sẻ được**: lưu site, ngày, chế độ vào query string (`?site=haworth&date=2028-01-15&mode=simple`); mở link là khôi phục đúng cảnh.
- **Bản đồ cực Nam 2D**: ảnh nền hillshade + lớp phủ % nắng (PGDA 69) bật/tắt được, các site là điểm bấm được.
- Ảnh xem trước khi chia sẻ link (thẻ `og:image` tĩnh trong `index.html`).

Tính năng phụ, chỉ làm khi 1–7 xong: nhập toạ độ tuỳ ý (astronomy-engine); tên núi từ IAU Gazetteer; viền vùng tối vĩnh cửu; lớp trạm DSN; chế độ game/giáo dục.

## 9. Quy tắc code

- Tên biến và hàm **dễ hiểu nhất có thể** (`sunElevation`, `findLongestDarkPeriod`), không viết tắt khó đoán.
- Code **ngắn nhất có thể**, không tối ưu sớm, không tạo abstraction thừa. Mỗi component một file, ngắn gọn.
- JavaScript thuần, không TypeScript. Comment ngắn bằng tiếng Anh, chỉ ở chỗ khó hiểu.
- Mỗi bước phải để lại một bản **chạy được** (`npm run dev` không lỗi). Gợi ý commit sau mỗi bước.
- Trước khi sửa nhiều file, nói ngắn gọn sẽ làm gì. Sau khi xong, nói cách chạy thử.
- Không bịa dữ liệu khoa học. Dữ liệu giả để dựng giao diện phải nằm trong `web/public/data/mock/` và có cờ `"mock": true`; giao diện hiện nhãn "MOCK DATA".
- Mỗi khi thêm thư viện, nguồn dữ liệu, ảnh: thêm một dòng vào `REFERENCES.md` và `DATA_SOURCES.md`.
- Ghi vào `AI_USAGE.md` một dòng cho mỗi phần việc lớn do Claude Code làm (luật cuộc thi yêu cầu khai báo AI).

## 10. Deploy Vercel

- Root Directory trên Vercel = `web`. Framework preset Vite: build `npm run build`, output `dist`.
- `.gitignore`: `node_modules/`, `dist/`, `.venv/`, `pipeline/raw/`, `*.tif`. GitHub chặn file > 100 MB.
- JSON trong `web/public/data/` phải nhỏ (mục tiêu < 2 MB mỗi file).
- Đường dẫn fetch tuyệt đối: `fetch("/data/haworth.json")`.
- Link cuối phải công khai, mở được bằng tab ẩn danh, không cần đăng nhập.

## 11. Kế hoạch

| Thời gian | Việc |
|---|---|
| Ngày 1 sáng | Khung `web/` + deploy Vercel lần đầu; pipeline Horizons cho 3 site; mock data để dựng UI song song |
| Ngày 1 chiều | Chân trời địa hình; Horizon view; timeline + countdown; metrics |
| Ngày 1 tối | Energy panel; Launch slip + heatmap |
| Ngày 2 sáng | Kiểm chứng PGDA 69; đủ 9 site; Compare; Simple/Expert |
| Ngày 2 trưa | Đóng băng tính năng, quay video demo |
| Ngày 2 chiều | Sửa lỗi, trang project tiếng Anh, slide, nộp sớm |

Yêu cầu bài nộp (đối chiếu Submission Guide 2026): tiếng Anh; High-Level Summary; link project công khai; demo tối đa 7 slide hoặc video 30 giây; mô tả chi tiết; dữ liệu cơ quan vũ trụ đã dùng; References.
