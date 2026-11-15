# Extra prospect: các module làm thêm sau khi nhóm xong bản chính

Cập nhật 15/11/2026 14:45. Viết trên `main` commit `675ff1e`. Mục tiêu: merge được trước **22:30**, vì cổng nộp đóng 23:59 và giám khảo sẽ mở link web.

## 0. Luật chung cho mọi module

- **Nhánh và PR:** mỗi module một nhánh `extra/<mã>` và một PR riêng, để bỏ được module lỗi mà không kéo theo module khác. Làm từ `main` mới nhất.
- **Trước khi merge,** chạy trong `web/`:
  ```bash
  node --test src/core/*.test.js
  npm run lint
  npm run build
  ```
  Nếu có đụng dữ liệu thì chạy thêm `python pipeline/check_web_data.py` ở thư mục gốc.
- **Mở bản preview Vercel của PR** và đi lại hai luồng: (a) Apollo 11; (b) ô `MAL-BASCS`, dates 2028-01-01 → 2028-06-30, stay 6 ngày, bấm Find, mở chi tiết.
- **Chữ giao diện:** thêm key vào `web/src/i18n/translations.js`. Bắt buộc có `en`; nên có `vi`. Ngôn ngữ thiếu key sẽ tự dùng bản tiếng Anh.
- **Hợp đồng dữ liệu:** đổi file dữ liệu hay chữ ký hàm thì phải sửa cùng lúc ba chỗ: README, `*.test.js`, `check_web_data.py`.
- **Ít đụng `App.jsx`:** file này đã conflict nhiều lần.
- **Sổ sách:** mỗi module thêm một dòng vào `AI_USAGE.md`; dữ liệu hoặc nguồn mới thì ghi vào `REFERENCES.md` và `DATA_SOURCES.md`.
- **Mốc dừng:** 22:30 không merge thêm gì nữa.

## 1. Thứ tự đề xuất

| Thứ tự | Mã | Module | Loại | Ước tính | Rủi ro | Cần dữ liệu mới? |
|---|---|---|---|---|---|---|
| 1 | E1 | Gom lỗi nhỏ | Sửa điểm yếu | 30 phút | Rất thấp | Không |
| 2 | E2 | Đưa kiểm chứng NASA ra mặt tiền | Khai thác điểm mạnh | 1–1,5 h | Thấp | Không (`validation.json`) |
| 3 | E3 | Nút "tìm cả quanh điểm này" | Sửa điểm yếu | 1–1,5 h | Thấp | Không |
| 4 | E4 | Mẫu tàu thật | Sửa điểm yếu | 1 h | Thấp | Số liệu công bố |
| 5 | E5 | Câu tiêu đề "nếu trễ lịch" | Khai thác điểm mạnh | 1 h | Thấp | Không |
| 6 | E6 | Mission Replay (IM-1, IM-2, Chandrayaan-3) | Galactic Impact, kiểm chứng | 3–4 h | Vừa | Horizons, 3 khung ngắn |
| 7 | E7 | Khoảng cách tới bẫy lạnh (PSR) | Best Use of Data, khoa học | 3–4 h | Vừa (đổi hợp đồng) | Không (PGDA 90 LPSR) |
| 8 | E8 | Mở chỏm ô 2 km tới 80°S | Độ phủ | 1 h code + thời gian máy | Vừa | Không (DEM 80 m tới 80°S) |
| 9 | E9 | Vùng Artemis gốc ở 1 km (Peak near Shackleton…) | Độ phân giải | 2–3 h + thời gian máy | Vừa | Zip LGRS cũ |
| 10 | E10 | Lớp lưới LGRS chính thức, toạ độ ACC | Độ tin cậy | 2 h | Thấp | Shapefile LGRS toàn cầu |

**Gợi ý:**
- Một người làm lần lượt E1 → E5 (khoảng 5 giờ, gần như không rủi ro).
- Nếu có người thứ hai, làm E6 hoặc E7 song song.
- E8 và E9 chỉ làm khi máy có sẵn `pipeline/raw/` và lần chạy thử đo thời gian cho thấy tính xong kịp.

---

## E1. Gom lỗi nhỏ (30 phút)

**Việc:**
1. `web/index.html`: đổi `og:image` thành URL đầy đủ `https://lunar-navigator-six.vercel.app/og-image.png`, và thêm `og:url`. Ảnh xem trước khi dán link chỉ hiện với URL đầy đủ.
2. `results.summary` ("{count} cells × …"): khi `count === 1` thì nói "1 cell". Làm bằng key riêng `results.summaryOne`, hoặc chọn key theo số ngay trong component.
3. Chú giải "1 square = 1 km": khi bản đồ đang hiện ô 2 km (CAP) hoặc điểm hiện tại là ô `CAP-`, thêm "· cap cells: 2 km".
4. Nhãn vùng MMO bị nhãn NR1 và "IM-2 Athena" đè: dời nhãn MMO (offset) hoặc ẩn nhãn site khi đang ở mức nhìn toàn cực. Xem `MapMarks.jsx`.

**Xong khi:** build qua, và bốn chỗ trên đều đúng khi xem trên bản preview.

---

## E2. Đưa kiểm chứng NASA ra mặt tiền (1–1,5 h)

**Vì sao:** đây là điểm mạnh nhất của nhóm. So với PGDA 69 trên 240 ô: r = 0,983 (nắng) và 0,986 (Trái Đất), sai số trung bình 1,9 và 3,6 điểm %. So với Horizons sai tối đa 0,015°. Hiện các con số này chỉ nằm ở cuối trang About.

**Việc:**
1. **Hàm thuần mới** `validationSummary(validation)` trong `web/src/core/validationStats.js`. Trả về `{sunR, earthR, sunMae, earthMae, cellCount, horizonsMaxDeg}`. Lấy từ `pgda69Stats` nếu có; nếu không thì tự tính từ mảng `pgda69`. Viết test cho hàm này bằng dữ liệu tổng hợp.
2. **Component `ValidationBadge.jsx`:** một chip nhỏ "✓ Validated vs NASA PGDA 69 (r = 0.98) and JPL Horizons (0.015°)". Bấm vào thì chuyển sang màn About.
   - Đặt ở đầu màn Results và màn Cell detail.
   - Chỉ cần thêm một prop `onOpenAbout` từ `App.jsx`.
3. **Component `ValidationScatter.jsx`** (ECharts, lazy-load giống lịch mùa):
   - 240 điểm, trục x là PGDA 69, trục y là số của nhóm, có đường y = x;
   - hai tab Sun và Earth.
   - Đặt trong `AboutView.jsx`, trên bảng hiện có.
4. **i18n:** thêm key `validation.badge`, `validation.scatterTitle`, `validation.axisNasa`, `validation.axisOurs`.

**Xong khi:** test của `validationStats` qua; chip hiện ở Results và Detail; biểu đồ phân tán vẽ đủ 240 điểm.

---

## E3. Nút "tìm cả quanh điểm này" (1–1,5 h)

**Vì sao:** chế độ Simple chỉ tìm trong 9 ô vuông, nên người dùng tưởng ngoài vùng không khả thi. Kiểm thử bằng Node cho thấy từ `MAL-BASCS` với bán kính 30 km có 500 ô 2 km được tìm, trong đó 337 ô từng pass.

**Việc:**
1. **Ở màn Results**, khi `scenario.searchScope === 'region'`, thêm nút "Also search 15 km around this point (includes 2 km cap cells)".
   - Bấm vào thì gọi lại `runSearch({...scenario, searchScope: 'radius', searchRadiusKm: 15})`.
   - Không đổi hợp đồng: phạm vi `radius` đã có, `MAX_SEARCH_RADIUS_KM = 50`.
2. **Dòng giải thích dưới bản đồ** (Map và Results): "Cells outside the 9 regions (2 km cap grid) are searched when you pick one as your point, or with 'Search around this point'."
3. **Hàm thuần** `suggestWiderSearch(scenario, results)` trong `core/` (tuỳ chọn): trả về `true` khi phạm vi là vùng và tỉ lệ ô đạt thấp, để làm nổi bật nút. Có test.

**Xong khi:** từ `MAL-BASCS`, bấm nút thì kết quả có ô `CAP-` trong bảng xếp hạng và trên bản đồ.

---

## E4. Mẫu tàu thật (1 h)

**Vì sao:** chỉ có "Example lander" nên các con số pin trông tuỳ tiện. `docs/window-finder.md` không có số liệu tàu: mọi số "công bố" phải mở nguồn bên dưới để đối chiếu, số không tìm thấy trong nguồn thì ghi là ước tính.

**Việc:**
1. **`web/src/core/scenario.js`, `LANDER_PRESETS`:** thêm các mẫu sau. Mỗi mục có `source`, `sourceUrl`, và cờ `published` hoặc `estimate` cho từng số.

   | id | Tấm pin | Pin | Tiêu thụ | Ở lại |
   |---|---|---|---|---|
   | `viper` | 450 W (công bố) | 5.420 Wh (công bố) | ~110 W (ước tính = 5.420 Wh ÷ 50 h chế độ tiết kiệm) | 30 ngày, vì `MAX_STAY_DAYS` = 30; ghi chú "mission planned 100 days" |
   | `nova-c` | 200 W (công bố) | ~700 Wh (25 Ah × 28 V, ước tính) | ~50 W (ước tính) | 14 ngày |
   | `blue-ghost-1` | 400 W (công bố) | ~1.400 Wh (ước tính) | ~100 W (ước tính) | 14 ngày |
   | `vikram` | 738 W (công bố) | ~2.600 Wh (ước tính) | ~185 W (ước tính) | 14 ngày |

   Nguồn:
   - VIPER: [NTRS 20240013903](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf)
   - Nova-C: [Wikipedia](https://en.wikipedia.org/wiki/Intuitive_Machines_Nova-C)
   - Blue Ghost: [Firefly](https://fireflyspace.com/missions/blue-ghost-mission-1/)
   - Vikram: [ISRO brochure](https://www.isro.gov.in/NSPD2024/assets/pdf/CH3%20Landing%20Brochure-Pagewise.pdf)
2. **`ScenarioForm.jsx`:**
   - thêm `stayDays` vào `PRESET_FIELDS` (hoặc chỉ điền khi người dùng chưa sửa tay);
   - dưới ô chọn mẫu, hiện một dòng nguồn có link, kèm nhãn "published / estimated".
3. **`scenario.test.js`:** mọi preset đều qua `validateScenario`.
4. **Ghi rõ trên giao diện:** "Approximate values from public documents, for comparing scenarios."

**Xong khi:** chọn VIPER thì form tự điền và Find chạy được; test qua.

---

## E5. Câu tiêu đề "nếu trễ lịch" (1 h)

**Vì sao:** "Can slip" là tính năng độc nhất, nhưng hiện đang nằm trong bảng.

**Việc:**
1. **Hàm thuần** `slipSentence(results, landingIndex, windows)` trong `core/format.js`, hoặc file mới `core/slip.js`. Trả về:
   - nếu điểm hiện tại đang đạt: "Your landing can slip up to **X** and still meet every limit (until …)";
   - nếu không đạt: "Next window at your point: … (in **Y**). Nearest cell that works now: … (**Z km**)."
   - Dùng dữ liệu có sẵn: `rankBestWindows` và `summarizeCurrentPoint`.
   - Viết test cho cả hai nhánh.
2. **Hiện câu này bằng chữ to** ở đầu `CurrentPointCard.jsx`.

**Xong khi:** test qua; luồng `MAL-BASCS` hiện câu đúng với các bảng phía dưới.

---

## E6. Mission Replay (3–4 h)

**Vì sao:** cho thấy app dự đoán khớp với sứ mệnh thật. Chân trời của `im-1`, `im-2` và `chandrayaan-3` **đã có** trong `web/public/data/sites.json`.

**Việc:**
1. **Pipeline:** thêm tuỳ chọn `--start/--stop/--out` cho `pipeline/fetch_horizons.py` (hoặc viết script nhỏ `fetch_replay.py` dùng lại hàm của D1). Lấy 3 khung, mỗi khung khoảng 3 tuần quanh ngày hạ cánh, ghi ra `web/public/data/replay/<siteId>.json`, cùng định dạng với `ephemeris.json`.
2. **`web/public/data/replay/index.json`:** với mỗi sứ mệnh ghi `{siteId, name, landedUtc, endedUtc, endedReason, sourceUrls}`.
   - **Ngày giờ phải lấy từ nguồn chính thức** (NASA, ISRO, Intuitive Machines) và ghi link.
   - Mốc tham khảo cần kiểm lại: Chandrayaan-3 hạ cánh 23/8/2023 12:33 UTC; IM-1 Odysseus hạ cánh 22/2/2024; IM-2 Athena hạ cánh 6/3/2025.
3. **Hàm thuần `core/replay.js`:** `replaySummary(site, replayEphemeris, mission)` → `{predictedSunsetUtc, predictedEarthsetUtc, hoursFromLandingToSunset, endedUtc, differenceHours}`. Dùng `computeSunTrack`, `computeEarthTrack`, `nextSunEvent`. Viết test với ephemeris tổng hợp.
4. **Giao diện:** thẻ "Real missions replayed" trong Learn (hoặc trên About), mỗi sứ mệnh một dòng gồm:
   - dự đoán giờ Mặt Trời lặn tại site;
   - thời điểm thực tế sứ mệnh kết thúc, kèm lý do (ví dụ IM-1 nằm nghiêng, IM-2 đổ trong hố lạnh);
   - chênh lệch tính bằng giờ.
   - Mỗi dòng có nút mở màn chi tiết của site với ngày hạ cánh thật.
5. **`check_web_data.py`:** kiểm thư mục `replay/` khi thư mục này tồn tại.

**Rủi ro:** tàu nằm nghiêng hay đổ làm mất điện sớm hơn hình học dự đoán. Vì vậy chỉ so **giờ Mặt Trời lặn tại site**, và ghi lý do thực tế cạnh kết quả. Không được ghi "chính xác" nếu số không khớp.

**Xong khi:** ba dòng có số; nguồn có link; test qua.

---

## E7. Khoảng cách tới bẫy lạnh (PSR) (3–4 h)

**Vì sao:** đề yêu cầu cân nhu cầu của "both science and engineering teams". Hiện app chỉ phục vụ phía kỹ sư.

**Việc:**
1. **Pipeline:** script mới `pipeline/compute_science_access.py`.
   - Đọc `LPSR_80S_20MPP_ADJ.TIF` (đã dùng ở D3). Hạ độ phân giải xuống khoảng 100 m, rồi dùng `rasterio.features.shapes` để tạo đa giác.
   - Giữ các PSR rộng từ 1 km² trở lên (khớp bảng 1.531 PSR của PGDA 90).
   - Với mỗi ô (vùng và CAP), tính `psrDistanceKm` tới PSR gần nhất bằng `shapely.STRtree`. shapely đi kèm geopandas, nên không thêm thư viện mới.
2. **Đổi hợp đồng:**
   - thêm trường `psrDistanceKm` (number | null) cho cell trong `cells_*.json` và `cap/*.json`;
   - D5 và `build_cap_grid.py` ghép trường này vào;
   - cập nhật README, `check_web_data.py`, và `make_mock_data.py` (dữ liệu giả).
3. **Lõi:** `runWindowSearch` chép `psrDistanceKm` của từng ô vào results như `distanceKm`; `rankCells` cho phép `sortBy: 'psrDistanceKm'` (nhỏ hơn là tốt hơn). Cập nhật test.
4. **Giao diện:**
   - cột "To cold trap (km)" ở bảng xếp hạng (chế độ Expert);
   - dòng tương ứng trong popup ô;
   - một lớp bản đồ "Distance to permanent shadow".
5. **Learn:** một câu giải thích vì sao PSR quan trọng (bẫy lạnh, nơi có thể có băng nước).

**Xong khi:** checker qua; sắp theo cột mới được; popup hiện số.

---

## E8. Mở chỏm ô 2 km tới 80°S

**Vì sao:** vành 80–85°S (quanh IM-1, CAB, NR2, MMP) chưa có ô. Toạ độ tự nhập ở đây đang dùng chân trời mặt cầu, sai nhiều.

**Việc:**
1. Thêm tham số `--south-of -80` cho `build_cap_grid.py`; vành ngoài 85°S có thể dùng ô 4 km để giảm số ô.
2. **Chạy thử đo thời gian trước:** `python pipeline/build_cap_grid.py --limit 200`. Ước lượng thời gian cho số ô vành mới (gấp khoảng 3 lần chỏm hiện tại ở ô 2 km). Nếu quá 2 giờ thì bỏ.
3. **Kiểm `MapCapLayer.jsx`:** README ghi lớp này vẽ bằng raster 152 × 152 px, tính cho bán kính 85°S. Phải đổi để kích thước tính từ `index.json`.
4. Chạy `check_web_data.py`, kiểm mỗi tile dưới 2 MB, kiểm tìm kiếm quanh IM-1 (80,13°S).

**Xong khi:** gõ toạ độ IM-1 thì dòng "Terrain from the 2 km cap grid" hiện ra; bản đồ phủ tới 80°S.

---

## E9. Vùng Artemis gốc ở 1 km (Peak near Shackleton, Connecting Ridge…)

**Vì sao:** đây là những điểm nổi tiếng nắng gần như quanh năm, rất hợp để demo. Hiện chúng chỉ có ô 2 km của chỏm cực.

**Việc:**
1. **Tải bằng trình duyệt** zip lưới 1 km từ bản phát hành USGS cũ cho 13 vùng: ScienceBase item `67168797d34ebf903f48b6fc`, doi:10.5066/P13FD9ZD. Bản này có Peak_Near_Shackleton, Connecting_Ridge, Connecting_Ridge_Extension, Faustini_Rim_A, Leibnitz_Beta_Plateau, Amundsen_Rim, de_Gerlache-Kocher_Massif…
2. Thêm mã vùng mới vào `pipeline/common.py`, rồi chạy D2 → D3 → D4 → D5 cho các vùng đó.
3. **Chạy lại `build_cap_grid.py`** để chỏm 2 km loại cả phạm vi của vùng mới; nếu không, ô sẽ trùng chỗ.
4. **`regions.json`:** đánh dấu `"artemis2024": false` và nhãn "original 2022 candidate", để không lẫn với 9 vùng chính thức hiện tại.

**Xong khi:** chọn Peak near Shackleton thì có ô 1 km và kết quả tìm kiếm.

---

## E10. Lớp lưới LGRS chính thức và toạ độ ACC (tuỳ chọn)

**Vì sao:** hiện đúng hệ toạ độ dẫn đường mà phi hành gia Artemis sẽ dùng làm tăng độ tin cậy.

**Việc:**
1. Tải các shapefile ô 25 km của LGRS cho vùng cực Nam (doi:10.5066/P13YPWQD), rồi xuất GeoJSON nhỏ chứa đường lưới và nhãn ô 25 km.
2. Thêm lớp bản đồ "LGRS 25 km grid".
3. Popup ô hiện nhãn ô 25 km và nhãn ACC 1 km. Nhãn ACC đã có sẵn trong `cell.label`.

---

## 2. Dữ liệu LGRS trước đó có dùng được không?

| Bộ dữ liệu | Đang dùng? | Dùng thêm được gì |
|---|---|---|
| **Terrestrial Navigational Training Grids** (ScienceBase `6751db29…`) | Không | **Không dùng được:** lưới tập huấn trên Trái Đất (UTM, WGS84) |
| **9 vùng "Down Selected"** (`671a6fa8…`, doi:10.5066/P1MEQ6UK) | Có, lưới 1 km (D2) | Zip còn lưới 100 m và 10 m. Có thể dùng để hiện nhãn ACC 100 m của điểm bấm (E10), hoặc để soi chi tiết trong một ô 1 km (chưa khuyên làm hôm nay vì phải tính chân trời lại) |
| **13 vùng gốc và Apollo 11–17** (`67168797…`, doi:10.5066/P13FD9ZD) | Không | **Hữu ích cho E9:** các vùng cực gốc dùng nguyên pipeline. Lưới Apollo thì chưa có giá trị, vì DEM PGDA 90 chỉ tới 60°S nên ô Apollo không có chân trời địa hình |
| **LGRS toàn cầu, phép chiếu LTM/LPS** (doi:10.5066/P13YPWQD) | Không | Lớp lưới chính thức và nhãn ô 25 km (E10) |

**Kết luận:** LGRS chỉ cho **vị trí và nhãn ô**, không có dữ liệu chiếu sáng. Giá trị tăng thêm nằm ở E9 (thêm vùng cực ở 1 km) và E10 (hệ toạ độ chính thức); cả hai đều cần chạy pipeline có DEM. Muốn tăng độ phủ của dữ liệu chiếu sáng thì E8 hiệu quả hơn, vì không cần LGRS.

## 3. Không làm hôm nay

- **Globe dùng tile phân giải cao (Moon Trek WMTS):** `globe.gl` mặc định ảnh tile theo phép chiếu Mercator, không phủ vùng cực; rủi ro CORS.
- **Chân trời cho site xích đạo bằng SLDEM2015:** phải tải DEM mới và đọc phép chiếu khác.
- **Soi chi tiết 100 m trong ô:** khó kiểm chứng.
- **Moon Base Network (gộp nắng nhiều ô):** để sau hackathon.

## 4. Dữ liệu thô cho E6–E10 (kiểm lúc 18:45 ngày 15/11)

`pipeline/raw/` đã được tải lại bằng `pipeline/download_data.py` sau sự cố sáng 15/11. Đủ 8 file của bảng 1 trong `DATA_SOURCES.md`. Thư mục `pipeline/raw/lgrs/` (zip LGRS tải tay) và cache `pipeline/raw/horizons/` không còn.

| Module | Cần gì | Tình trạng | Ai làm |
|---|---|---|---|
| E6 | JPL Horizons API, 3 khung ngắn | Script tự gọi API, cache mới vào `pipeline/raw/horizons/` | Tự động |
| E7 | `LPSR_80S_20MPP_ADJ.TIF` | Có sẵn | Tự động |
| E8 | `LDEM_80S_80MPP_ADJ`, `LDEM_60S_240MPP_ADJ`, `LDSM_80S_80MPP_ADJ`, `LPSR_80S_20MPP_ADJ` | Có sẵn. Chỉ còn phải đo thời gian chạy | Tự động |
| E9 | Zip lưới 1 km của các vùng gốc: ScienceBase `67168797d34ebf903f48b6fc`, doi:10.5066/P13FD9ZD | **Chưa có.** ScienceBase chặn script, phải tải bằng trình duyệt vào `pipeline/raw/lgrs/` | **Người trong nhóm tải tay** |
| E10 | Shapefile lưới LGRS 25 km cực Nam, doi:10.5066/P13YPWQD | **Chưa có.** Tải bằng trình duyệt vào `pipeline/raw/lgrs_global/` | **Người trong nhóm tải tay** |

- Zip 1 km của 9 vùng hiện tại (doi:10.5066/P1MEQ6UK) cũng đã mất. Không cần tải lại, vì `pipeline/out/grid_<CODE>.json` đã commit; chỉ cần khi chạy lại D2 cho 9 vùng.
- E9 chạy lại D2 → D5 cho vùng mới và chạy lại `build_cap_grid.py`, nên cần cả DEM ở hàng E8.
