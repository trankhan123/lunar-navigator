# Phân công: 5 workflow + web

Nhóm có 5 người. Một người lo web: tổng hợp mọi phần lên giao diện. Bốn người còn lại chọn workflow:

- mỗi workflow gom các module D (pipeline Python) và C (lõi JS trong trình duyệt) liên quan đến nhau, nên một người làm từ dữ liệu tới hàm tính;
- có **5 workflow cho 4 người**, xem cách chia ở mục [Nếu chỉ có 4 bạn](#nếu-chỉ-có-4-bạn).

Hợp đồng chính thức (input/output, đơn vị, định dạng file, chữ ký hàm) vẫn nằm trong [README.md](README.md). File này chỉ nói **ai làm gì, theo thứ tự nào, giao gì cho ai**. Mọi mục trong README như "C1 Sunlight" hay "D4 Terrain horizon" là phần phải đọc trước khi code.

## Bảng chọn

| Workflow | Chủ đề | Module | Khối lượng | Người nhận |
|---|---|---|---|---|
| [WF1](#wf1--sunlight-và-địa-hình) | Sunlight và địa hình | C1 Sunlight, D4 Terrain horizon | nặng (~9 h) | |
| [WF2](#wf2--sóng-liên-lạc-và-kiểm-chứng) | Sóng liên lạc và kiểm chứng | C2 Communication, D6 Famous sites, D7 Validation | vừa (~7 h) | |
| [WF3](#wf3--quãng-đường-và-tối-ưu) | Quãng đường và tối ưu | C5 Optimizer, `core/explain.js` | vừa (~7 h) | |
| [WF4](#wf4--năng-lượng-cần-và-thời-gian-sạc) | Năng lượng cần và thời gian sạc | C3 Energy need, C4 Charging, `validateScenario` | nhẹ (~5 h) | |
| [WF5](#wf5--bản-đồ-và-toạ-độ) | Bản đồ và toạ độ | D2 LGRS grid, D3 Feasibility, D5 Build web data, D8 Map background | vừa (~8 h) | |
| [WEB](#web--tổng-hợp-giao-diện) | Tổng hợp giao diện | W1–W7, S1 | nặng | trankhan123 |

**Đã xong:** C0 (hình học, chuỗi giờ) và D1 (ephemeris thật trong `web/public/data/ephemeris.json`, khớp JPL Horizons trong phạm vi 0,015°). Mọi workflow dùng được hai phần này ngay.

**Cách nhận:**

1. Ghi tên vào cột "Người nhận" ở bảng trên.
2. Ghi tên vào cột `Owner` trong bảng module của README cho **mọi** module của workflow, và đặt `Status` là `doing`.
3. Commit và push ngay, để hai người không nhận trùng.

**"Quãng đường" ở WF3** là khoảng cách (km) tới ô đạt gần nhất, cùng với việc xếp hạng ô và thời điểm. Tìm đường đi cho xe tự hành đã bỏ (docs/window-finder.md §3.2).

## Ai giao gì cho ai

```
            WF5 grid_MAL.json ──────────────> WF1 (D4 tính chân trời)
            WF1 horizon_MAL.json ───────────> WF5 (D5 gộp)
WF1 C1 sunlight.js ──┬──> WF3 (evaluateWindow), WF4 (dùng dạng SunTrack), WF2 (D7), WEB
WF2 C2 communication.js ─┼──> WF3, WEB
WF4 C4 charging.js ──────┼──> WF3, WEB (biểu đồ pin)
WF4 C3 energyNeed.js, validateScenario ──> WEB
WF5 cells_<CODE>.json, regions.json, sites.json, maps/ ──> WEB, WF3, WF2 (D7)
WF2 sites.json (toạ độ D6) ──> WF5 (D5 xuất bản), WF1 (chân trời cho site ≤ −60°)
WF2 validation.json ──> WEB (trang About)
WF3 optimizer.js, explain.js ──> WEB (kết quả, chi tiết, chế độ học)
```

| Thứ tự | Ai giao | Giao cái gì | Ai cần | Mốc |
|---|---|---|---|---|
| 1 | WF1 | `sunlight.js` qua test | WF3, WF4, WF2, WEB | **sớm nhất có thể** (vài giờ đầu) |
| 1 | WF2 | `communication.js` qua test | WF3, WEB | vài giờ đầu |
| 1 | WF4 | `charging.js` qua test | WF3, WEB | vài giờ đầu |
| 2 | WF5 | `pipeline/out/grid_MAL.json` | WF1 | ngay khi có shapefile LGRS |
| 3 | WF1 | `pipeline/out/horizon_MAL.json` | WF5 | chiều ngày 1 |
| 4 | WF5 | `cells_MAL.json`, `regions.json`, `sites.json` | WEB, WF3, WF2 | tối ngày 1 → **mốc M1** |
| 4 | WF3 | `optimizer.js` qua test, Worker chạy trên mock | WEB | tối ngày 1 |
| 5 | WF5 + WF1 | đủ 9 vùng | WEB | sáng ngày 2 |
| 5 | WF2 | `sites.json` đủ toạ độ, `validation.json` | WEB | sáng ngày 2 |

**Mốc chung:**

- **M1 (cuối ngày 1):** chạy trọn luồng cho vùng Malapert (MAL) bằng dữ liệu thật: bản đồ → form → kết quả → chi tiết.
- **M2 (sáng ngày 2):** đủ 9 vùng, site nổi tiếng, kiểm chứng PGDA 69.
- **M3 (trưa ngày 2):** đóng băng tính năng, deploy Vercel, quay video.

## WF1 — Sunlight và địa hình

**Mục tiêu:** biết mỗi ô có nắng lúc nào và tấm pin nhận được bao nhiêu. Để vậy cần hai phần: đường chân trời địa hình 360° (D4) và quỹ đạo Mặt Trời theo giờ (C1).

**File của bạn:** `web/src/core/sunlight.js`, `pipeline/compute_horizon.py`, `pipeline/out/horizon_*.json`.

**Các bước:**

1. **C1 trước**, vì ba workflow khác chờ nó. Không cần dữ liệu thật: test có sẵn, và có thể chạy thử trên `ephemeris.json` thật cùng `mock/cells_MAL.json`.
   - `resolvePanelType`, `panelFactor`;
   - `computeSunTrack`: mỗi giờ gọi `bodyAzimuthElevation` (C0) với `sunSubLonDeg/sunSubLatDeg/sunDistanceAu × AU_KM`, rồi `horizonElevationAt` và `visibleDiskFraction` với `SUN_DISK_RADIUS_DEG`. `powerFactor = (1/D)² × diskFraction × panelFactor`;
   - `summarizeSunWindow` và `nextSunEvent`: dùng `longestRunBelow`, `fractionAtLeast`, `meanWhereAtLeast`, `firstIndexBelow`, `nextCrossing` từ `timeSeries.js`;
   - chạy `cd web && node --test src/core/sunlight.test.js`, rồi push.
2. **D4 trên các điểm đã có toạ độ**, trước khi có lưới: hàm `compute_horizon(lat, lon, near_dem, far_dem)` chạy với tâm 9 vùng trong `pipeline/sites.json`.
   - Vẽ thử chân trời tâm Malapert và so bằng mắt với QuickMap hoặc Moon Trek.
   - Ghi `pipeline/out/horizon_sites.json` cho các site có lat ≤ −60°.
3. **D4 cho lưới:** khi WF5 push `grid_MAL.json`, chạy `--region MAL` để ghi `horizon_MAL.json`, push, rồi làm đủ 9 vùng.

**Lưu ý dữ liệu** (đã kiểm tra 14/11):

- **CRS chung:** `common.PGDA_CRS`, nodata là `nan`, độ cao tính bằng mét so với mặt cầu 1737,4 km.
- **`LDEM_80S_80MPP_ADJ.TIF`:** 7600×7600, 80 m/px, phủ ±304 km quanh cực.
- **`LDEM_60S_240MPP_ADJ.TIF`:** 7760×7760, 240 m/px, phủ ±931 km. Dùng cho phần tia đi ra ngoài ô vuông ±304 km. Peak near Cabeus B cách cực 196 km, nên tia 150 km của nó chắc chắn ra ngoài.
- **Công thức** (README D4): `angle = atan2(h_mẫu − h_ô − 2 m − d²/(2R), d)`, ghi `round(10 × độ)`.
- **Tốc độ:** 225 ô × 360 tia × vài trăm mẫu. Vector hoá bằng numpy, nội suy song tuyến tính, không lặp Python từng mẫu.

**Xong khi:** `sunlight.test.js` qua; có `horizon_<CODE>.json` cho 9 vùng và `horizon_sites.json`; một chân trời đã đối chiếu bằng mắt.

## WF2 — Sóng liên lạc và kiểm chứng

**Mục tiêu:**

- biết lúc nào thấy Trái Đất để liên lạc direct-to-Earth (C2);
- điền toạ độ site nổi tiếng (D6);
- chứng minh kết quả đúng bằng nguồn NASA (D7).

**File của bạn:** `web/src/core/communication.js`, `pipeline/sites.json` (chỉ các site TODO và mục `sources`), `pipeline/validate.py`, `pipeline/visibility_stats.mjs` (tạo mới), `web/public/data/validation.json`.

**Các bước:**

1. **C2:** làm giống C1 nhưng dùng `earthSubLonDeg/earthSubLatDeg/earthDistanceKm` và `EARTH_DISK_RADIUS_DEG`.
   - Luôn tính từ vị trí ô, vì thị sai tới 0,26°.
   - `summarizeEarthWindow` và `nextEarthEvent` (`'earthset'|'earthrise'`).
   - Chạy `node --test src/core/communication.test.js`, rồi push.
2. **D6:** điền `lat/lon` cho 13 site `"source": "TODO"` (Apollo 12/14/16, IM-1/2/3, Blue Ghost 1, Chang'e 3–6, Chandrayaan-3, SLIM).
   - Chỉ lấy từ nguồn chính thức (LROC, NASA, CNSA, ISRO, JAXA).
   - Mỗi nguồn thêm vào `sources`, `REFERENCES.md` và `DATA_SOURCES.md` §3.
   - **Không đoán.** Site có lat ≤ −60° (ví dụ Chandrayaan-3) đặt `hasTerrain: true` và báo WF1 tính chân trời.
3. **D7, khi WF5 có `cells_MAL.json`:**
   - viết `pipeline/visibility_stats.mjs` (node, import `web/src/core/sunlight.js` và `communication.js`): tính `sunFraction` và `earthFraction` của các ô trên toàn bộ ephemeris, ghi `pipeline/out/our_visibility.json`;
   - `validate.py`: đọc pixel PGDA 69 tại các ô đó (giá trị × 4e-05 = tỉ lệ thời gian; chỉ phủ 85–90°S, nên CAB, MMP, NR2 không có), rồi ghi `validation.json` theo README;
   - mục `horizons` lấy từ fixture: 30 điểm, sai lệch 0,015° / 0,010°;
   - chụp một ảnh QuickMap "Compute Visibility" cho slide.

**Liên quan tiêu chí mới** (docs/window-finder.md, thứ tự xếp thứ 5, "liên lạc liền mạch nhất"): đo bằng `longestCommLossHours` nhỏ hơn. WF3 dùng nó để phân thắng khi mọi tiêu chí trước bằng nhau.

**Xong khi:** `communication.test.js` qua; không còn site TODO (hoặc site còn lại có `note` giải thích); có `validation.json`; trang About có số để WEB hiển thị.

## WF3 — Quãng đường và tối ưu

**Mục tiêu:** đây là lõi "Window Finder".

- Trượt khung `stayDays` ngày qua mọi ô khả thi và mọi thời điểm hạ cánh (bước 6 giờ), đánh giá đạt / sát ngưỡng / không đạt.
- Xếp hạng, và tìm thời điểm đạt gần nhất cùng ô đạt gần nhất (km).
- Viết câu giải thích vì sao dời vài km lại khác nhau.

**File của bạn:** `web/src/core/optimizer.js`, `web/src/core/explain.js` (phần logic của W5/W7; WEB chỉ dựng component).

**Các bước:**

1. **Phần không cần C1/C2/C4:** `metricsAt`, `rankCells`, `rankBestPairs`, `summarizeCurrentPoint`, `selectSearchCells` (dùng `distanceKm` của C0). Test có sẵn trong `optimizer.test.js`.
   - **Thứ tự mặc định:** đạt hoặc sát ngưỡng trước → `minBatteryFraction` cao hơn → `fractionBoth` cao hơn → `distanceKm` nhỏ hơn → `longestCommLossHours` nhỏ hơn (liên lạc liền mạch nhất).
   - Không dùng điểm có trọng số.
2. **`evaluateWindow` và `runWindowSearch`,** khi WF1/WF2/WF4 đã push C1/C2/C4: mỗi ô tính hai track một lần, trượt khung, rồi bỏ track đi.
   - Chạy thử trong trình duyệt bằng `startWindowSearch` (Worker đã viết sẵn) với `mock/cells_MAL.json`.
   - Mục tiêu tốc độ: phạm vi `region` dưới 3 giây.
3. **`explain.js`:**
   - `compassName`;
   - `explainDifference`: tìm các giờ ô hiện tại tối mà ô kia có nắng, so chân trời hai ô tại phương vị Mặt Trời lúc đó, rồi viết câu tiếng Anh;
   - `findMostDifferentNeighbors`;
   - thêm test cho hai hàm sau vào `explain.test.js`.

**Xong khi:** `optimizer.test.js` và `explain.test.js` qua; Worker chạy trên mock MAL dưới 3 giây; giao WEB dữ liệu `WindowResults` thật.

## WF4 — Năng lượng cần và thời gian sạc

**Mục tiêu:** quy nắng ra điện.

- Lander có sống qua khung không, pin thấp nhất bao nhiêu, mất bao lâu sạc đầy lại (C4).
- Cần pin tối thiểu bao nhiêu để sống qua khung (C3).
- Kiểm tra form nhập giới hạn sứ mệnh.

**File của bạn:** `web/src/core/charging.js`, `web/src/core/energyNeed.js`, `validateScenario` và `LANDER_PRESETS` trong `web/src/core/scenario.js`.

**Các bước:**

1. **C4 trước**, vì WF3 cần nó:
   - `simulateBattery`: pin đầy lúc hạ cánh; mỗi giờ `clamp(pin + panelMaxW × powerFactor − loadW, 0, capacity)`; tính `deadAtHour`, `rechargeHours`, `chargingMask`;
   - `findFullChargeWindows`: mức pin tại mỗi lần Mặt Trời lặn;
   - chạy `node --test src/core/charging.test.js`, rồi push.
2. **C3:**
   - `findDarkPeriods`;
   - `summarizeEnergyNeed`: `minimumCapacityWh` là thâm hụt tích luỹ lớn nhất, công thức ở README C3.
3. **`validateScenario`:** quy tắc ở bảng Scenario trong README; mỗi trường tối đa một lỗi, viết bằng tiếng Anh.
   - `LANDER_PRESETS` chỉ là ví dụ minh hoạ, không phải thông số tàu thật. Muốn thêm preset thì ghi rõ "illustrative".
4. **Nếu còn thời gian:** đối chiếu kết quả C3/C4 với công thức tính tay trên 2–3 ô mock, ghi vào README C3.

**Không cần chờ ai:** chỉ dùng dạng `SunTrack` (`powerFactor`, `diskFraction`), test có sẵn dữ liệu giả.

**Xong khi:** `charging.test.js`, `energyNeed.test.js` và `scenario.test.js` qua.

## WF5 — Bản đồ và toạ độ

**Mục tiêu:** dựng lưới ô 1 km chuẩn USGS LGRS cho 9 vùng Artemis III, rồi đánh dấu ô khả thi (độ dốc, vùng tối vĩnh cửu). Sau đó gộp mọi thứ thành file web đọc được và làm ảnh nền bản đồ.

**File của bạn:** `pipeline/build_grid.py`, `compute_feasibility.py`, `build_site_data.py`, `export_map_background.py`, `pipeline/out/grid_*.json`, `feasibility_*.json`, `web/public/data/regions.json`, `cells_*.json`, `sites.json`, `web/public/maps/`.

**Các bước:**

1. **Tải shapefile** bằng **trình duyệt** (script bị chặn 403) tại https://www.sciencebase.gov/catalog/item/671a6fa8d34efed5620f89f8 (McClernan 2024, doi:10.5066/P1MEQ6UK), lưu vào `pipeline/raw/lgrs/`. Thiết kế lưới và nhãn ACC: USGS T&M 11-E1 (doi:10.3133/tm11E1).
2. **D2 `build_grid.py`** (geopandas đã có trong `requirements.txt`):
   - lấy tâm từng ô 1 km, đổi sang lat/lon và `xM/yM` theo `PGDA_CRS`;
   - nhãn lấy theo thuộc tính ACC; ghi tên thuộc tính vào README D2;
   - **làm `MAL` trước và push `grid_MAL.json` ngay cho WF1**, rồi làm đủ 9 vùng;
   - ghi số ô mỗi vùng vào bảng vùng trong README.
3. **D3 `compute_feasibility.py`:**
   - `slopeDeg` là trung vị độ dốc trong ô;
   - `psrFraction` là tỉ lệ pixel vùng tối vĩnh cửu;
   - `heightM` là độ cao tại tâm.
4. **D5 `build_site_data.py`:** gộp grid + feasibility + horizon (của WF1) + `pipeline/sites.json`, rồi chạy `python pipeline/check_web_data.py`. Xong `MAL` là đạt **mốc M1**.
5. **D8 `export_map_background.py`:** hillshade → PNG ≤ 1 MB cho toàn cực và cho từng vùng, kèm `maps.json`; có thêm lớp phủ % nắng PGDA 69 nếu kịp.

**Lưu ý dữ liệu** (đã kiểm tra 14/11):

- **`LDSM_80S_80MPP_ADJ.TIF`:** độ dốc tính bằng độ, float32, 7600×7600, 80 m/px.
- **`LPSR_80S_20MPP_ADJ.TIF`:** giá trị 0/1, float32, **30400×30400**. Cả file khoảng 3,7 GB trong RAM, nên **đọc theo cửa sổ** (`rasterio.windows`) quanh từng ô, không đọc cả file.
- **Hướng trục:** trong `PGDA_CRS`, `+x` hướng về kinh độ 90°E, `+y` hướng về kinh tuyến 0°.
- **Vùng lớn:** Mons Mouton Plateau rộng khoảng ±58 km, có thể ra hơn 2.000 ô. Nếu `cells_MMP.json` vượt 2 MB, báo nhóm trước khi đổi định dạng.

**Xong khi:** `check_web_data.py` qua trên `web/public/data` cho 9 vùng; có `maps.json`; số ô từng vùng đã ghi trong README.

## WEB — Tổng hợp giao diện

**Người làm:** trankhan123. Phần này dựng mọi component và nối các workflow vào giao diện. Phần logic thuần đã chuyển cho workflow khác:

- `explain.js` thuộc WF3;
- `validateScenario` thuộc WF4.

**Module:** W1 khung app + link chia sẻ, W2 bản đồ + popup, W3 form, W4 kết quả, W5 chi tiết, W6 globe, W7 chế độ học, S1 bài nộp. Chi tiết props ở README.

**Thứ tự gợi ý:**

1. W1 khung app trên mock: các màn hình, nhãn MOCK DATA, footer nguồn dữ liệu.
2. W3 form.
3. W2 bản đồ, đọc `mock/cells_MAL.json`.
4. W4 kết quả: nối `startWindowSearch` khi WF3 push.
5. W5 chi tiết: horizon view, đếm ngược, biểu đồ pin. Cần C1, C2, C4.
6. W7, rồi W6 (bỏ trước nếu trễ).
7. Deploy, rồi S1.

**Điểm nối:** mỗi khi một workflow push xong, đổi phần tương ứng từ mock sang thật. Dữ liệu thật tự bật khi có `web/public/data/regions.json` (README W1).

## Quy tắc chung cho mọi workflow

- **Trước khi code:** đọc mục module của mình trong README. Hàm, trường JSON, đơn vị và tên file đã cố định.
- **Chỉ sửa file trong mục "File của bạn".** Cần đổi hợp đồng thì hỏi nhóm trước, rồi sửa cùng lúc README, test và `pipeline/check_web_data.py`.
- **Commit nhỏ, push sớm:** `git pull --rebase` trước khi push. Mỗi commit phải qua `cd web && npm run lint && npm run build`.
- **Test của mình:**
  - JS: `cd web && node --test src/core/<file>.test.js`;
  - dữ liệu: `python pipeline/check_web_data.py`.
- **Dữ liệu:** không bịa dữ liệu khoa học. Không commit `pipeline/raw/` và `*.tif`. Nguồn mới ghi vào `REFERENCES.md` và `DATA_SOURCES.md`; việc lớn làm bằng AI ghi vào `AI_USAGE.md`.
- **Dùng Claude Code:**
  - mở Claude Code trong repo, skill dự án tự nạp;
  - gõ ví dụ "Implement WF4 theo distribution.md";
  - Claude sẽ đọc README, CLAUDE.md và làm đúng hợp đồng.

## Nếu chỉ có 4 bạn

Có 5 workflow mà chỉ 4 người, nên **tách WF2** cho ba người:

- **C2** cho người làm **WF4**: C2 làm giống C1 và nhẹ; WF4 cộng thêm C2 vẫn khoảng 6–7 h.
- **D6** cho người làm **WF5**: điền toạ độ site đi cùng phần bản đồ.
- **D7** cho người xong việc sớm nhất. D7 thuộc mốc M2 (sáng ngày 2), không nằm trên đường găng.

Khi tách, ghi lại tên người nhận C2, D6 và D7 ở bảng chọn phía trên.
