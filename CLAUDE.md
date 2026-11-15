# CLAUDE.md — Lunar Landing Site Navigator: Window Finder (NASA Space Apps 2026)

File này là bối cảnh cố định cho Claude Code. Đọc hết trước khi làm bất kỳ việc gì.
Đọc thêm ba file:

- `README.md`: **hợp đồng module**, bản chính thức gồm input/output, đơn vị, định dạng file và bảng chia việc.
- `docs/window-finder.md`: ý tưởng cuối cùng của nhóm.
- `distribution.md`: phân công 5 người, gồm 5 workflow (WF1–WF5 gom các module D + C liên quan) và WEB, kèm thứ tự làm và việc giao nhận giữa các workflow.
- `DATA_SOURCES.md`: mọi file dữ liệu, URL và thư viện.
- `docs/extra-prospect.md`: các module làm thêm E1–E10 sau bản chính (15/11 tối), luật nhánh `extra/<mã>` và mốc dừng merge 22:30.

## 1. Bối cảnh

- **Cuộc thi:** NASA Space Apps Challenge 2026, đề **Lunar Landing Site Navigator**.
- **Thời gian:** 14–15/11/2026. Hạn nộp **23:59 ngày 15/11 giờ Việt Nam**, mục tiêu nộp sớm vài giờ.
- **Người dùng mục tiêu của đề:** mission planner, nhà giáo dục, công chúng.
- **Yêu cầu cốt lõi của đề:**
  - hiển thị Mặt Trời và Trái Đất so với đường chân trời tại điểm đổ bộ theo thời gian, để đánh giá cửa sổ phát điện và cửa sổ liên lạc direct-to-Earth;
  - so sánh nhanh site khác hoặc ngày khác khi lịch sứ mệnh bị trượt;
  - đề nhắc hai lần phải hiển thị **còn bao lâu đến lúc Mặt Trời lặn / Trái Đất lặn**.
- **Mặt Trăng không có khí quyển** nên không có khúc xạ. Chân trời do địa hình và độ cong mặt cầu quyết định.
- **Ý tưởng chốt ngày 14/11 là "Window Finder"** (`docs/window-finder.md`):
  - người dùng chọn điểm hạ cánh dự kiến trên lưới LGRS 1 km của USGS, khoảng ngày và giới hạn sứ mệnh (tối tối đa, mất liên lạc tối đa, tấm pin, pin, mức tiêu thụ);
  - công cụ tìm ô và thời điểm hạ cánh tốt nhất trong cùng vùng;
  - kéo thanh thời gian (bước 6 giờ) để xem bảng xếp hạng thay đổi.

Câu định vị: *"Tell us your landing spot and your mission's limits. We find the best nearby sites and dates, ranked hour by hour."*

## 2. Tech stack (đã chốt, không đổi)

| Phần | Công nghệ |
|---|---|
| Tiền xử lý dữ liệu | Python 3.11+, `requests`, `numpy`, `rasterio`, `pyproj`, `geopandas` (đọc shapefile LGRS) |
| Web | Vite + React (**JavaScript, không dùng TypeScript**) |
| Tính toán trong trình duyệt | JS thuần trong `web/src/core/`, chạy tìm kiếm trong **Web Worker** |
| Test | `node --test` có sẵn trong Node (không thêm thư viện test) và `pipeline/check_web_data.py` |
| Bản đồ 2D cực Nam | SVG + d3-zoom 3.0.0 (kéo/phóng; cả chuỗi d3 ghim bằng overrides trong web/package.json), ảnh nền hillshade PNG |
| Quả cầu 3D | `globe.gl` (quả cầu W6 dùng globe.gl) |
| Địa hình 3D | `three` 0.187.0, ghim chính xác, tải lười (globe.gl dùng cùng bản) |
| Biểu đồ | ECharts (`echarts` + `echarts-for-react`) |
| CSS | Tailwind |
| Deploy | Vercel, web tĩnh, không backend |

- Không thêm thư viện ngoài danh sách nếu chưa hỏi.
- Không dùng React Router; chuyển màn hình bằng state.
- `astronomy-engine` đã cài nhưng chỉ còn là module tuỳ chọn X1: dùng cho ngày nằm ngoài ephemeris.

## 3. Kiến trúc: tính trước, phục vụ tĩnh

Ngoại lệ được yêu cầu cho chat UX: `web/api/mission-chat.js` là Node Vercel Function
gọi Gemini để chuẩn bị form, có Redis hạn mức; mọi tính toán khoa học vẫn ở browser.
Xem `docs/mission-chat-setup.md`. Không cần MCP server, model cục bộ hay training.

```
[Python, chạy trên máy, một lần]
  JPL Horizons ── D1 ─> ephemeris.json (điểm dưới Mặt Trời / Trái Đất theo giờ, 2027-01 → 2029-01)
  LGRS USGS ───── D2 ─> pipeline/out/grid_<CODE>.json ──┐
  PGDA 90 slope, PSR ─ D3 ─> feasibility_<CODE>.json ────┼─ D5 ─> cells_<CODE>.json, regions.json, sites.json
  PGDA 90 DEM ─── D4 ─> horizon_<CODE>.json ─────────────┘
  PGDA 69 ─────── D7 ─> validation.json        hillshade ─ D8 ─> maps/*.png
  PGDA 90 DEM ─── D8b ─> maps/relief/*.jpg     PGDA 90 DEM ─ D10 ─> terrain/*.bin
  D2–D4 + PGDA 90 ─ D9 ─> data/cap/*.json (lưới 2 km ngoài 9 vùng)
[Trình duyệt, Vercel]
  core/ C0 hình học · C1 nắng · C2 liên lạc · C3 năng lượng cần · C4 sạc pin · C5 tối ưu (Worker)
  UI W1–W7: bản đồ, form, kết quả, chi tiết, globe, chế độ học
```

- **Vị trí Mặt Trời/Trái Đất** tại bất kỳ ô hay toạ độ nào đều tính từ điểm dưới thiên thể bằng một công thức vector (README mục C0). Nhờ vậy toạ độ tuỳ ý cũng chạy được, không cần gọi Horizons cho từng ô.
- **Chân trời địa hình** chỉ có cho ô lưới và cho site có lat ≤ −60°. Điểm khác dùng chân trời mặt cầu (0°), và giao diện ghi "terrain not included".
- **Thư mục:**
  - `pipeline/`: D1–D10 (kể cả D8b), `common.py`, `check_web_data.py`, `make_mock_data.py`, `out/` (file trung gian, có commit), `raw/` (gitignore);
  - `web/src/core/`: module JS thuần kèm `*.test.js`;
  - `web/src/components/`: mỗi component một file;
  - `web/public/data/` (`mock/` là dữ liệu giả, `cap/` là lưới 2 km toàn cực), `web/public/terrain/` (khối địa hình 3D), `web/public/maps/relief/` (ảnh địa hình nhiều mức).

## 4. Data contract và hợp đồng module

**Bản chính thức nằm ở `README.md`.** Ở đây chỉ tóm tắt. Muốn đổi hợp đồng thì đổi cùng lúc README, test `web/src/core/*.test.js` và `pipeline/check_web_data.py`, sau đó báo nhóm.

- **Quy ước:**
  - độ ở mọi nơi; azimuth tính theo chiều kim đồng hồ từ Bắc (0–360); kinh độ Đông −180…180, hệ ME;
  - thời gian UTC dạng `YYYY-MM-DDTHH:mmZ`; giờ i của ephemeris = `startTime + i h`;
  - năng lượng tính bằng W/Wh;
  - "thấy" = ≥ 50 % đĩa nằm trên chân trời; bán kính đĩa: Mặt Trời 0,27°, Trái Đất 0,95°.
- **`ephemeris.json`:** dạng cột `sunSubLonDeg, sunSubLatDeg, sunDistanceAu, earthSubLonDeg, earthSubLatDeg, earthDistanceKm`, bước 1 giờ.
- **`cells_<CODE>.json`:**
  - mỗi ô gồm `id` (`<CODE>-<nhãn ACC>`), `label, lat, lon, xM, yM, heightM, slopeDeg, psrFraction, feasible, infeasibleReason`;
  - `horizon` gồm 360 số nguyên, đơn vị 0,1°.
- **Mã vùng:** CAB HAW MAL MMP MMO NR1 NR2 DGR SLP.
- **Mỗi file JSON** là một object, nhỏ hơn 2 MB. Dữ liệu giả chỉ nằm trong `web/public/data/mock/`, có `"mock": true`, và giao diện hiện nhãn "MOCK DATA".

## 5. Dữ liệu và nguồn

- **JPL Horizons:**
  - ephemeris: `COMMAND=301`, `CENTER=500@399`, `QUANTITIES=14,15,19,20`, bước 1h, chia theo quý, cache ở `pipeline/raw/horizons/`;
  - kiểm chứng: `COMMAND=10/399`, `CENTER=coord@301`, `SITE_COORD=lon,lat,alt_km`, `QUANTITIES=4`. Bước `1h` đã thử OK (14/11): 1 tháng = 745 dòng.
- **PGDA 90 (LOLA, cực Nam):**
  - `LDEM_80S_80MPP_ADJ` (DEM gần), `LDEM_60S_240MPP_ADJ` (DEM xa và site tới 60°S);
  - `LDSM_80S_80MPP_ADJ` (độ dốc), `LPSR_80S_20MPP_ADJ` (vùng tối vĩnh cửu 20 m), hillshade.
- **PGDA 69:** `AVGVISIB_85S_060M_201608` (+`_EARTH`), dùng để kiểm chứng; chỉ phủ 85–90°S.
- **Lưới LGRS:**
  - shapefile ACC 1 km của 9 vùng: McClernan 2024, doi:10.5066/P1MEQ6UK. Phải tải bằng trình duyệt vì ScienceBase chặn script;
  - thiết kế lưới: USGS Techniques & Methods 11-E1 (2025), doi:10.3133/tm11E1;
  - không dùng "Terrestrial Navigational Training Grids".
- **Ngưỡng độ dốc 20°:** theo tài liệu NASA HLS cho Space Apps 2025 (NTRS 20250009323).
- **Texture Mặt Trăng:** NASA SVS 4720.
- **KHÔNG tự bịa toạ độ.** Site chưa có nguồn thì để `lat/lon: null` và `"source": "TODO"`; code bỏ qua và in cảnh báo (`common.load_sites()`). NASA không công bố toạ độ số của 9 vùng: toạ độ tâm vùng lấy từ ô vuông USGS và gắn `verified: false` (xem `DATA_SOURCES.md` mục 3).

## 6. Thuật toán lõi (chi tiết: `docs/window-finder.md` §4–5 và README)

- **Chân trời:**
  - 360 tia, lấy mẫu từ 100 m tới 150 km;
  - góc = `atan2(h_mẫu − h_ô − cột − d²/(2R), d)`, cột mặc định 2 m.
- **Nhìn thấy:**
  - `frac = clamp((el − H + ρ) / 2ρ, 0, 1)`;
  - giờ tối khi nắng < 0,5; giờ mất liên lạc khi Trái Đất < 0,5.
- **Hệ số nắng:**
  - `(1 AU / D)² × frac × hệ số tấm pin`;
  - tấm đứng dùng `cos(el)`, tấm nằm ngang dùng `max(sin el, 0)`;
  - chế độ auto: |lat| ≥ 60° thì dùng tấm đứng.
- **Pin:**
  - đầy lúc hạ cánh;
  - `pin = clamp(pin + Pmax × hệ số nắng − tải, 0, dung lượng)` mỗi giờ;
  - pin chạm 0 thì ghi là hết pin.
- **Khung trượt:** với mỗi ô khả thi trong phạm vi tìm và mỗi thời điểm hạ cánh (bước 6 giờ), khung dài `stayDays × 24` giờ.
- **Kết quả mỗi khung:**
  - **đạt** khi tối dài nhất ≤ giới hạn, mất liên lạc dài nhất ≤ giới hạn và pin không cạn;
  - đạt mà pin thấp nhất < 20 % thì là **sát ngưỡng**.
- **Xếp hạng:** đạt trước, rồi pin thấp nhất cao hơn, rồi % có cả nắng lẫn Trái Đất cao hơn, rồi gần hơn, rồi liên lạc liền mạch hơn (mất liên lạc dài nhất ngắn hơn). Không dùng điểm có trọng số.
- **Kiểm chứng:**
  - so vector với Horizons (< 0,1°) qua fixture. **Đã đạt ngày 14/11:** 30 điểm, sai lệch tối đa 0,015° phương vị và 0,010° góc cao;
  - so % nắng và % thấy Trái Đất với PGDA 69 (chỉ cần cùng xu hướng);
  - so một ô với QuickMap.

## 7. Năng lượng (module C3, C4)

- Ví dụ trong form (1000 W, 10 kWh, 300 W) chỉ để minh hoạ. Giao diện phải ghi rõ đây không phải thông số tàu thật.
- C3 "năng lượng cần": tìm các khoảng tối và tính dung lượng pin tối thiểu để sống qua khung, bằng thâm hụt tích luỹ lớn nhất.
- C4 "sạc": mô phỏng pin theo giờ, số giờ sạc đầy lại, và mức pin tại mỗi lần Mặt Trời lặn.

## 8. Giao diện (chi tiết: `docs/window-finder.md` §3)

Chữ trên giao diện mặc định bằng **tiếng Anh**; có bộ chọn 7 ngôn ngữ (i18n, chữ mới dùng `t()`, xem §9). Chạy tốt trên laptop, dùng được trên điện thoại.

1. **Bản đồ 2D cực Nam** (W2): tô ô khả thi, ô không khả thi để xám. Bấm ô sẽ mở popup có ID, độ dốc, Mặt Trời/Trái Đất và nút "Use as current point".
2. **Form kịch bản** (W3): có chế độ Simple và Expert.
3. **Kết quả** (W4):
   - thanh trượt thời điểm hạ cánh kèm Play;
   - bản đồ đổi màu xanh/vàng/đỏ, bảng top 10 cập nhật ngay;
   - thẻ "điểm hiện tại", dải trạng thái theo thời gian, top 10 cặp.
4. **Chi tiết** (W5):
   - horizon view có đường đi của Mặt Trời **và** Trái Đất;
   - **đồng hồ đếm ngược sunset/Earthset to, nổi bật**; góc cao Mặt Trời hiển thị to;
   - biểu đồ pin; so sánh hai chân trời kèm một câu giải thích; xuất CSV.
5. **Quả cầu 3D** (W6) và **chế độ học** (W7).
6. **Minh bạch và chia sẻ:**
   - footer ghi nguồn dữ liệu và độ phân giải; trang About có mục Known limitations (`docs/window-finder.md` §7);
   - link chia sẻ lưu kịch bản trong query string; thẻ `og:image` tĩnh.

Nếu trễ, bỏ theo thứ tự: quả cầu 3D, chế độ học, phạm vi "cả 9 vùng".

## 9. Quy tắc code

- Tên biến và hàm **dễ hiểu nhất có thể** (`sunElevation`, `findLongestDarkPeriod`), không viết tắt khó đoán. Tên có đơn vị (`…Deg`, `…Km`, `…Wh`, `…Hours`, `…Fraction`).
- Code **ngắn nhất có thể**, không tối ưu sớm, không tạo abstraction thừa. Mỗi component một file, ngắn gọn.
- JavaScript thuần, không TypeScript. Comment ngắn bằng tiếng Anh, chỉ ở chỗ khó hiểu.
- Module trong `web/src/core/` là hàm thuần: không dùng React, không đụng DOM, không fetch (trừ `data.js`).
- Mỗi bước phải để lại một bản **chạy được** (`npm run dev` không lỗi, `npm run lint && npm run build` qua). Gợi ý commit sau mỗi bước.
- Trước khi sửa nhiều file, nói ngắn gọn sẽ làm gì. Sau khi xong, nói cách chạy thử.
- Không bịa dữ liệu khoa học. Giá trị trong test là dữ liệu tổng hợp và phải ghi rõ như vậy.
- Mỗi khi thêm thư viện, nguồn dữ liệu, ảnh: thêm một dòng vào `REFERENCES.md` và `DATA_SOURCES.md`.
- Ghi vào `AI_USAGE.md` một dòng cho mỗi phần việc lớn do Claude Code làm (luật cuộc thi yêu cầu khai báo AI).
- Nhận module: ghi tên vào bảng module trong README. Chỉ sửa file của module mình.
- Chữ mới trên giao diện dùng khoá `t()` và có cả khối `en` lẫn `vi` trong `web/src/i18n/translations.js`. Khoá thiếu thì rơi về tiếng Anh.

## 10. Deploy Vercel

- Root Directory trên Vercel = `web`. Framework preset Vite: build `npm run build`, output `dist`.
- `.gitignore`: `node_modules/`, `dist/`, `.venv/`, `pipeline/raw/`, `*.tif`, `.env*`, `.vercel/`. GitHub chặn file > 100 MB.
- JSON trong `web/public/data/` phải nhỏ hơn 2 MB mỗi file.
- Đường dẫn fetch tuyệt đối, đi qua `web/src/core/data.js`.
- Link cuối phải công khai, mở được bằng tab ẩn danh, không cần đăng nhập.

## 11. Kế hoạch (chi tiết: `docs/window-finder.md` §8, bảng module trong README)

| Thời gian | Việc |
|---|---|
| Ngày 1 (14/11) | D1 ephemeris + kiểm chứng vector; D2–D5 cho vùng Malapert (MAL) rồi đủ 9 vùng; C0–C5; W1–W4 trên mock. Mục tiêu: chạy trọn luồng cho một vùng |
| Ngày 2 sáng | W5 chi tiết, D6 site nổi tiếng, W6 globe, W7 chế độ học, D7 kiểm chứng PGDA 69 + QuickMap |
| Ngày 2 trưa | Đóng băng tính năng, deploy Vercel, quay video demo |
| Ngày 2 chiều | Sửa lỗi, trang project tiếng Anh, slide, nộp sớm |
| Ngày 2 tối | Module thêm E1–E7 (`docs/extra-prospect.md`), mỗi module một nhánh `extra/<mã>` và một PR; 22:30 dừng merge |

Yêu cầu bài nộp (đối chiếu Submission Guide 2026):

- viết bằng tiếng Anh;
- High-Level Summary;
- link project công khai;
- demo tối đa 7 slide hoặc video 30 giây;
- mô tả chi tiết;
- dữ liệu cơ quan vũ trụ đã dùng;
- References.
