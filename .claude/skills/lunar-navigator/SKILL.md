---
name: lunar-navigator
description: Bối cảnh đầy đủ, môi trường và quy tắc làm việc cho dự án Lunar Landing Site Navigator (NASA Space Apps 2026, hạn 23:59 15/11/2026 giờ VN), ý tưởng Window Finder — spec, hợp đồng module trong README, data contract, dữ liệu PGDA/Horizons đã tải, venv, lệnh chạy, deploy Vercel, bài học đã rút ra và cách dùng các skill ECC trong dự án. Dùng skill này cho MỌI việc trong repo "nasa app hackathon", và bất cứ khi nào người dùng nhắc tới Window Finder, module (D1–D8, C0–C5, W1–W7), LGRS, lưới ô, ô khả thi, ephemeris, Mặt Trăng, landing site, Artemis, Horizons, DEM, LOLA, PGDA, đường chân trời, sunset/Earthset, countdown, pin/energy, launch slip, globe, horizon view, astronomy-engine, Vercel, demo, slide hoặc bài nộp — kể cả khi họ không gọi tên skill.
---

# Lunar Landing Site Navigator — skill dự án

Skill gồm hai phần. **Phần A** là môi trường, quy trình và bài học, cập nhật liên tục trong lúc làm. **Phần B** là spec, giống hệt `CLAUDE.md` ở thư mục gốc.

**Nhiệm vụ thường trực:** chỉnh skill cho khớp dự án. Mỗi khi có quyết định mới, bài học mới, file dữ liệu mới hay lệnh mới, ghi ngay vào Phần A. Khi spec đổi, sửa cả `CLAUDE.md` lẫn Phần B. Skill ECC nào không còn hợp thì sửa phần "Ghi chú dự án" của nó hoặc xoá đi.

## Phần A — Môi trường, quy trình, bài học

### Môi trường (đã cài và chạy thử ngày 14/11)

| Thứ | Chi tiết |
|---|---|
| Python | Máy của người tạo repo: venv `~/python/math_env` (Python 3.14), luôn `source ~/python/math_env/bin/activate` trước. Máy thành viên khác: `.venv` (đã gitignore) cài `pip install -r pipeline/requirements.txt`. Thư viện: requests, numpy, rasterio 1.5.2, pyproj 3.8.0, geopandas 1.2.0 (cài 14/11 cho D2, kéo theo pyogrio 0.13.0, shapely 2.2.0) |
| Node | v20.20 (nvm), npm 10.8. `npm i -g` không cần sudo |
| Vercel CLI | 65.15, đã đăng nhập |
| GitHub | Repo **private** `trankhan123/lunar-navigator`, remote `origin` = `git@github.com:trankhan123/lunar-navigator.git` (SSH đã xác thực). Không có `gh` CLI. Thêm thành viên ở Settings → Collaborators. Commit đầu `cd00306` ngày 14/11 |
| Playwright | Chromium nằm trong `~/.cache/ms-playwright`; headless chạy được, máy không thiếu thư viện hệ thống |
| ffmpeg | 8.0.1 (dùng cho video demo) |
| MCP (`.mcp.json`) | `playwright` (Chromium bundled), `context7` (tra tài liệu thư viện), `firecrawl` (cần `FIRECRAWL_API_KEY`: chạy không key bị từ chối vì "IP looks like a VPN or proxy"), `exa` (key `EXA_API_KEY` nằm trong `~/.bashrc`; Exa connector của claude.ai cũng dùng được) |

### Dữ liệu đã tải sẵn

Chạy `python pipeline/download_data.py`. Script đọc bảng ở mục 1 của `DATA_SOURCES.md`; file nào đã tải đủ thì bỏ qua.

- `pipeline/raw/` (bị gitignore), khoảng 920 MB:
  - PGDA 90: `LDEM_80S_80MPP_ADJ.TIF` (DEM), `LDEM_80S_80MPP_ADJ_HILL.TIF` (hillshade cho bản đồ 2D), `LDSM_80S_80MPP_ADJ.TIF` (độ dốc, D3), `LPSR_80S_20MPP_ADJ.TIF` (PSR 20 m, D3), `LDEM_60S_240MPP_ADJ.TIF` (DEM xa, D4); ba file sau thêm ngày 14/11;
  - PGDA 69: `AVGVISIB_85S_060M_201608.TIF` và `..._EARTH.TIF` (kiểm chứng), `LPSR_85S_060M_201608.TIF`.
- **Chưa có:** shapefile LGRS ACC 1 km (D2). ScienceBase chặn script, nên người dùng phải tải bằng trình duyệt vào `pipeline/raw/lgrs/`.
- `web/public/textures/lroc_color_2k.jpg`: texture Mặt Trăng từ SVS 4720, có commit vào git.

### Toạ độ site (`pipeline/sites.json`, điền ngày 14/11)

- Quy ước: `lat` độ Bắc (Nam là âm), `lon` độ Đông trong khoảng −180…180 (Tây là âm). Nếu Horizons không nhận kinh độ âm thì đổi sang 0…360 ngay trong `fetch_horizons.py`.
- **NASA không công bố toạ độ số** cho 9 vùng Artemis III: NTRS 20250011660 và thông cáo 28/10/2024 chỉ có tên và bản đồ.
- **9 vùng Artemis:** tâm ô vuông vùng của USGS (McClernan 2024, doi:10.5066/P1MEQ6UK), lấy qua MoonSnag, gắn `"verified": false`. Đối chiếu với NASA Lunar Surface Data Book (qua realestateonthemoon.com): lệch dưới 10 km, riêng Slater Plain lệch 28,6 km (nguồn đối chiếu lấy tâm hố Slater nên giữ giá trị USGS).
- **3 site Apollo (11, 15, 17):** vị trí Lunar Module theo NASA NSSDCA (Wagner et al. 2017), gắn `"verified": true`.
- **Muốn kiểm chứng tận gốc:** mở bằng trình duyệt thật https://www.sciencebase.gov/catalog/item/671a6fa8d34efed5620f89f8 rồi tải file ranh giới vùng (~622 KB). ScienceBase có Cloudflare chặn truy cập tự động; không cố vượt.
- Cả 9 site Artemis nằm trong DEM (cách cực 56–196 km). Peak near Cabeus B cách cực 196 km, nên tia 150 km của D4 vượt mép DEM 80°S (304 km); phần xa lấy từ `LDEM_60S_240MPP_ADJ.TIF`.

### Window Finder: module và hợp đồng (chốt 14/11)

- **Ý tưởng cuối:** `docs/window-finder.md`. **Hợp đồng chính thức:** `README.md`, gồm bảng module, quy ước, định dạng file và chữ ký hàm.
  - Đổi hợp đồng thì đổi cùng lúc README, `web/src/core/*.test.js` và `pipeline/check_web_data.py`.
- **Module:**
  - D1 ephemeris, D2 lưới LGRS, D3 ô khả thi, D4 chân trời, D5 build web data, D6 site nổi tiếng, D7 kiểm chứng, D8 ảnh nền bản đồ, D8b địa hình nhiều mức, D9 lưới 2 km toàn cực, D10 khối địa hình 3D;
  - C0 hình học + chuỗi giờ, C1 nắng, C2 liên lạc, C3 năng lượng cần, C4 sạc pin, C5 tối ưu ("quãng đường tối ưu" = xếp hạng ô/thời điểm và ô đạt gần nhất; tìm đường rover đã bỏ);
  - W1 app shell, W2 bản đồ, W3 form, W4 kết quả, W5 chi tiết, W6 globe, W7 chế độ học, S1 bài nộp.
- **Đã làm sẵn:** `core/data.js` (loader, `hourIndexOf`, `timeAtHour`), hằng số và `countDays` trong `scenario.js`, Worker (`windowSearchWorker.js`, `startWindowSearch.js`), `pipeline/common.py`, `check_web_data.py`, `make_mock_data.py`, mock trong `web/public/data/mock/` (vùng MAL 7×7, ephemeris giả 2028-01 → 2028-07).
- **Xong ngày 14/11 (Claude):**
  - C0 (`geometry.js`, `timeSeries.js`);
  - D1 (`fetch_horizons.py`): `web/public/data/ephemeris.json` thật (2027-01-01 → 2029-01-31, 18.288 giờ, 0,69 MB) và fixture `web/src/core/fixtures/horizons_check.json`;
  - kiểm chứng vector với Horizons: sai lệch tối đa 0,015° phương vị, 0,010° góc cao trên 30 điểm.
- **Phân công (14/11):** `distribution.md`.
  - WF1 = C1 + D4 (sunlight, địa hình); WF2 = C2 + D6 + D7 (liên lạc, kiểm chứng); WF3 = C5 + `explain.js` (quãng đường, tối ưu); WF4 = C3 + C4 + `validateScenario` (năng lượng, sạc); WF5 = D2 + D3 + D5 + D8 (bản đồ, toạ độ); WEB = W1–W7 + S1 (trankhan123).
  - Nhóm 5 người nhưng chỉ 4 bạn cho 5 workflow, nên tách WF2: C2 → WF4, D6 → WF5, D7 → ai xong trước.
  - Khi người dùng nói "làm WFn", đọc mục đó trong `distribution.md` rồi làm đúng thứ tự và chỉ sửa file trong "File của bạn".
- **Tiêu chí xếp hạng thứ 5:** thành viên `vominhuy28` thêm "liên lạc liền mạch nhất" vào docs (commit 3af1fed); đã quy thành `longestCommLossHours` nhỏ hơn.
- **WEB (nhánh `web`, 14/11):**
  - xong lượt đầu: W1 khung app (`App.jsx`: các màn hình map/results/globe/about, Simple/Expert, nhãn MOCK, footer, link chia sẻ đồng bộ URL), W2 `SouthPoleMap.jsx` (SVG theo `xM/yM`) + `CellPopup.jsx`, W3 `ScenarioForm.jsx`, `AboutView.jsx`;
  - logic mới: `core/shareLink.js`, `core/format.js` (`formatDuration`, `formatUtc`), `toPolarXY` và `resolveCurrentCell` trong `core/data.js`;
  - còn chờ: W4 (cần C5), W5 (cần C1/C2/C4), W6 texture, W7. Đã xoá `web/public/data/mock/legacy/`.
- **Trạng thái 14/11 tối (`web` đã merge vào `main`, commit dccb949):**
  - Mọi module lõi đã có code thật: C1 (Quoc_Bao), C2 (chubin271-blip), C3/C4/`validateScenario` (hoanggbach), C5/explain (vominhuy28). 83 test qua.
  - D4 `compute_horizon.py` (Quoc_Bao) đã review: ship được.
  - Luồng web chạy trọn: W4 có thanh trượt, bảng xếp hạng, thẻ điểm hiện tại, dải trạng thái, top cặp; W5 có màn hình chi tiết với `core/detail.js`, `countdownText`, `currentPointSentence`.
  - `DetailView` và globe tải lười.
  - WF3 (PR #5, #6) đã sửa `rankBestWindows` (quét một lượt giữ top 10: 138 ms ở 225 ô × 728 lần hạ cánh) và chiều câu `explainDifference`.
  - Lỗi trắng trang Apollo (`selectSearchCells` trả `[]` khi không có ô nào trong 1 km) đã được Quoc_Bao sửa trên nhánh `PathAndFuel` (f939da2), merge vào `main` ở 66fdf5d ngày 15/11.
  - Vercel production: từ 15/11 project đã nối GitHub, **push `main` là tự deploy production** (Root Directory = `web`). Bản 09:40 ngày 15/11 từ f8279b4 (gồm bản đồ v3, lưới CAP, 3D, globe, PR #12, WF2 với DSN tuỳ chọn và chat ẩn) đã kiểm tra trên link công khai: 0 lỗi console. Chạy `vercel deploy` từ `web/` giờ lỗi "Root Directory web does not exist"; không cần chạy tay nữa.
- **WF5 (14/11 tối, Claude Code làm theo yêu cầu của trankhan123):** dữ liệu thật đã có cho 8 vùng.
  - Chạy lại toàn bộ theo thứ tự: `build_grid.py` → `compute_feasibility.py` (12 s) → `compute_horizon.py --region ALL --sites` (của WF1, ~10 phút) → `build_site_data.py` → `export_map_background.py` → `check_web_data.py`.
  - Shapefile đọc thẳng từ zip trong `pipeline/raw/lgrs/`, không cần giải nén. Nhãn là thuộc tính `LGRS_ACC`, luôn 5 ký tự; khoảng 10 % nhãn có `-` (ví dụ `AYR--`), nên chỉ lấy phần trước dấu `-` đầu tiên làm mã vùng.
  - CRS của shapefile là LPS: stereographic cực trên cầu 1737,4 km, k0 = 0,994, lệch Đông/Bắc 500 km. Vì vậy một ô 1 km rộng 1006 m trong `PGDA_CRS`; D3 lấy nửa cạnh ô là 500/0,994 m.
  - Số ô (khả thi): CAB 441 (252), HAW 930 (906), MAL 462 (286), MMP 4524 (3810), MMO 289 (222), NR1 441 (273), NR2 420 (343), DGR 441 (399), SLP 441 (419).
  - **MMP (quyết định 14/11):** đủ 4524 ô sẽ nặng 6,3 MB, nên file web chỉ giữ 900 ô gần tâm vùng nhất (850 ô khả thi, bán kính khoảng 17 km), theo `KEPT_CELL_COUNT` trong D5. `pipeline/out/` vẫn giữ đủ 4524 ô.
  - Test pipeline: `python -m pytest pipeline/test_build_site_data.py pipeline/test_validate.py`.
- **W7 Learn (14/11 khuya, xong):** tab "Learn" (`LearnView.jsx`, tải lười, dùng chung ECharts với DetailView); logic thuần trong `core/learn.js` gồm `metricSentences`, `neighborLesson`, `moonFacts`, có test `learn.test.js` và một test tích hợp. Góc Mặt Trời trung bình có thể âm ở ô trên cao vì ô đó nhìn vượt độ cong Mặt Trăng; câu chữ phải nói "dưới đường chân trời phẳng", không ghi "cao −1,4°". `HorizonChart` giờ nhận các prop tuỳ chọn `horizonLabel`, `caption`; đường đi Sun/Earth cũng tuỳ chọn.
- **Bản đồ W2 v2 (15/11, xong):** spec `docs/superpowers/specs/2026-11-14-polar-map-design.md`, kế hoạch `docs/superpowers/plans/2026-11-14-polar-map.md` (16 task; sổ theo dõi trong `.superpowers/sdd/`, đã gitignore).
  - `SouthPoleMap.jsx` được viết lại tại chỗ: một SVG theo mét PGDA, viewBox ±304 km, SVG y = −yM, d3-zoom. Các component con: `MapCells`, `MapMarks`, `MapLegend`, `MapLayersPanel`, `MapTimeBar`, `MapMinimap`, `CellHoverCard`, `DirectionCard`, `MapSearch`. Logic thuần có test: `core/mapView.js`, `mapLayers.js`, `mapSky.js`, `mapSearch.js`.
  - Ghim cả 17 gói d3 (kể cả 11 gói `globe.gl` kéo vào) bằng `overrides` trong `web/package.json`, về bản trước đợt phát hành 03/11/2026; riêng `d3-delaunay` ghim 6.0.4.
  - `maps.json` có 4 kind: `hillshade`, `sun-visibility`, `earth-visibility`, `psr` (35 mục); checker kiểm cả `maps.json`.
  - Lớp "% theo khoảng ngày" chạy trong Web Worker tìm kiếm (message `fractions`), có cache theo vùng và khoảng ngày, khởi chạy sau 400 ms. Mất khoảng 3 s cho HAW 930 ô × 6 tháng.
  - Hiệu năng: React chỉ dựng cấu trúc ô; màu ô được ghi trực tiếp trong `useLayoutEffect` của `SouthPoleMap`. Đo trên bản build với HAW: trung vị 8 ms, tối đa 15 ms mỗi giờ (trước đó tối đa 29 ms).
  - Cuộn chuột chỉ phóng khi bản đồ đang được chọn (hoặc giữ Ctrl/⌘). Ở toàn cực, khung vùng nhận cú bấm; khi đã mở vùng thì khung không nhận nữa.
  - Chú giải PGDA 69 ghi "long-term average", không ghi "18.6-year", vì metadata không nêu giai đoạn lấy trung bình.
- **Skill superpowers (14/11):** đã chép 15 skill của obra/superpowers v7.0.2 vào `.claude/skills/` (MIT, xem `NOTICE.md`), không cài hook. Quy trình cho tính năng lớn: `brainstorming` (hỏi người dùng, viết design doc vào `docs/superpowers/specs/`) → `writing-plans` → `subagent-driven-development` hoặc `executing-plans`, kèm `test-driven-development`.
  - Thời gian tìm kiếm khoảng 6 tháng: MAL 4,1 s, HAW 11,9 s (chạy trong Worker, mục tiêu là < 3 s).
  - App tự dùng dữ liệu thật khi có `web/public/data/regions.json`; thêm `?mock=1` để quay về mock. Bản đồ W2 vẽ `web/public/maps/<CODE>.png` theo `maps.json`.
- **Quy trình nhánh:** thành viên hay push thẳng vào `main` hoặc vào nhánh riêng, đôi khi rebase nên trùng nội dung khác SHA. Trước khi làm, luôn `git fetch`, merge `origin/main` và các nhánh mới vào `web`, chạy `npm test`. README/AI_USAGE/distribution hay conflict: giữ tên người thật và gộp cả hai dòng AI_USAGE.
- **Vite dev trong VM:** lần đầu import động `echarts-for-react`, Vite tối ưu lại dependency rồi tải gói ~75 s. Màn hình đứng ở "Loading…" là bình thường, bản build không bị.
- **Không còn hàm khung:** `web/src/core/notImplemented.js` đã xoá ngày 15/11, mọi hàm core đã có code thật. Không còn `throw notImplemented(...)` hay `raise NotImplementedError` trong `web/src` và `pipeline`.
- **Bản nháp cũ:** `App.jsx` đọc `/data/mock/legacy/`. W1 thay nó bằng luồng Window Finder rồi xoá `legacy/`.

### Trạng thái 15/11 sáng (sau merge `e3d0acd`, nhánh `web`)

- **i18n 7 ngôn ngữ:** `web/src/i18n/` (`useI18n()`, `t()`). Khoá thiếu thì rơi về tiếng Anh. Khoá mới thêm vào khối `en` và `vi` trong `translations.js`. Nhánh Translation đã merge.
- **Sửa audit:**
  - C5 `optimizer.js` không còn bản sao toán C1/C2/C4;
  - `rankBestPairs` đổi thành `rankBestWindows` (một dòng mỗi ô: thời điểm hạ cánh tốt nhất và số giờ "có thể trượt"); component `BestWindowsTable.jsx` (trước là `BestPairsTable.jsx`);
  - gợi ý phạm vi tìm hiện số giờ chờ;
  - `explainDifference` so chân trời tại góc phương vị Mặt Trời, trong các giờ chỉ một ô được chiếu sáng;
  - thẻ "1 km" trong Learn nêu cả hai ô, ưu tiên ô lân cận cải thiện tối dài ít nhất 12 giờ, và ghi "Elsewhere in this region" khi cặp không chứa điểm hiện tại;
  - Results ẩn bản đồ cực với điểm nằm ngoài bản đồ, hiện tên site, và có dòng "Smooth-sphere horizon: terrain not included";
  - thêm meta và Open Graph; xoá `notImplemented.js`.
- **D7 xong với PGDA 69:** 240 ô, 8 vùng. Mặt Trời r 0,983, Trái Đất r 0,986, lệch trung bình −0,1 và −2,1 điểm %. Kết quả trong `validation.json` và trang About. QuickMap chưa làm.
- **D9 lưới 2 km toàn chỏm cực:** `pipeline/build_cap_grid.py`, `web/public/data/cap/` (60 tile, 17.336 ô, 14.996 khả thi, 23 MB, 4,1 MB gzip). Nối vào bản đồ (lớp raster ở mức tổng quan), điểm hiện tại và tìm kiếm ("Within a radius" trên toàn chỏm; "Same region" với điểm ngoài 9 vùng = ô CAP trong 15 km).
- **D8b relief tiles:** `pipeline/export_relief_tiles.py`, `web/public/maps/relief/` (152 JPEG, khoảng 7,5 MB, 5 mức, mức mịn nhất 74 m/px), tô màu cividis trung tính kèm đường đồng mức. Lớp phủ toàn cực: % nắng, % Trái Đất, PSR và loại `slope` mới. `maps.json` có 39 mục.
- **D10 địa hình 3D:** `pipeline/export_terrain_mesh.py`, `web/public/terrain/*.bin` (9 vùng, mỗi file ≤ 205 kB), `TerrainView3D.jsx`. Chiếu sáng bằng Mặt Trời thật theo giờ của bản đồ. Dùng `three` 0.187.0 ghim chính xác (đã có sẵn qua globe.gl).
- **W6 quả cầu:** ánh sáng thật từ điểm dưới Mặt Trời; tia Mặt Trời và Trái Đất từ site đã chọn; pin có nhãn, chú giải, vòng vùng, nút camera; bấm vùng thì mở bản đồ 2D. Texture SVS 4720: `lroc_color_4k.jpg`, `ldem_bump_1440.png`, ghi credit "NASA's Scientific Visualization Studio".
- **Sự cố và bài học:** một agent commit symlink `pipeline/raw`, vì quy tắc ignore `pipeline/raw/` chỉ khớp thư mục. Khi merge commit đó, git xoá thư mục dữ liệu thô đã bị ignore. Đã sửa: quy tắc ignore là `pipeline/raw`, dữ liệu tải lại bằng `pipeline/download_data.py`.
  - Không bao giờ symlink `pipeline/raw`; đọc file thô bằng đường dẫn tuyệt đối;
  - trước khi merge, chạy `git ls-tree -r <branch> --name-only | grep pipeline/raw`;
  - worktree của agent bắt đầu từ `main`, không phải nhánh hiện tại, nên merge nhánh hiện tại trước.
- **Chưa làm:** preset lander VIPER, Nova-C, Blue Ghost, Vikram. Repo chưa có số liệu có nguồn nên không bịa.

### Module thêm E1–E10 (15/11 tối, `docs/extra-prospect.md`)

- Opus điều phối, Sonnet/Haiku làm: mỗi module một agent trong worktree riêng (tạo từ `main` local, nên phải `git fetch origin main:main` trước), một nhánh `extra/E<n>`. Brief chung nằm trong scratchpad của phiên; luật chính chép lại ở đây.
- Agent **không** sửa `AI_USAGE.md`, `REFERENCES.md`, `DATA_SOURCES.md`, `CLAUDE.md`, skill: các file này chỉ sửa trên nhánh `extra/docs` để các PR không conflict.
- Chống conflict `translations.js`: mỗi module chèn khoá ngay sau một khoá mốc riêng ở cả khối `en` và `vi` (E1 `results.summary`, E2 `about.pgdaUnavailable`, E3 `results.noSlack`, E4 `scenario.exampleNote`, E5 `currentPoint.searchedOnly`, E6 `learn.moonTitle`, E7 `columns.status`). `App.jsx` chỉ sửa đúng một chỗ đã giao.
- `docs/window-finder.md` không có số liệu tàu (bản kế hoạch ghi nhầm "§11"): số liệu E4 phải mở nguồn để đối chiếu.
- Dữ liệu thô: 8 file PGDA đủ; `pipeline/raw/lgrs/` (zip LGRS tải tay) và cache Horizons đã mất. E9 (doi:10.5066/P13FD9ZD) và E10 (doi:10.5066/P13YPWQD) cần người tải bằng trình duyệt; E6–E8 tự lo được.
- scipy có trong venv nhưng không có trong `requirements.txt`: không dùng (E7 dùng rasterio + shapely).
- **Máy là VM 2 CPU, 5,3 GB RAM, 4 GB swap.** Tối 15/11 chạy 8 agent song song (npm ci, vite build, raster lớn, build_cap_grid nhiều tiến trình) làm máy treo 3 lần, phải tắt cứng, git có 5 object rỗng (đã sửa, bản sao ở `~/git-empty-objects-backup-20261115`). Quy tắc từ nay: mỗi lúc một agent; job nặng chạy qua `.claude/worktrees/guarded.sh <log> <lệnh>` (giới hạn 1,7 GB RAM, 1,5 CPU, tự dừng khi RAM cả máy > 80 %, theo yêu cầu người dùng); không chạy Playwright song song job nặng. `/tmp` bị xoá khi khởi động lại: ghi chú để trong `.claude/worktrees/` (gitignore).
- `compute_feasibility.read_region` đọc cả vùng bao của mọi ô: với lưới tới 80°S nó đọc trọn raster PSR 3,7 GB. Phải đọc theo từng lô.
- Nếu Claude plan (5 giờ) vượt 80 % thì cũng dừng agent và báo người dùng.

### Lệnh hay dùng

```bash
cd web && npm test            # node --test src/core/ (Node 20 nhận thư mục)
cd web && node --test src/core/sunlight.test.js
python pipeline/check_web_data.py [web/public/data/mock]
python pipeline/make_mock_data.py
cd web && npm run dev          # dev server
cd web && npm run lint && npm run build
source ~/python/math_env/bin/activate && python pipeline/<script>.py
git push origin web:main      # deploy: Vercel builds production from main itself (Root Directory = web); do not run vercel deploy from web/
```

### Bài học đã rút ra

- **Raster đã tải (kiểm tra 14/11):** tất cả dùng CRS `+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m`.
  - DEM `LDEM_80S_80MPP_ADJ`: 7600×7600, float32, độ cao tính bằng mét (−7254…7007), phủ ±304 km, nodata `nan`.
  - PGDA 69 `AVGVISIB_*`: 5058×5058, int16, phủ ±152 km, nodata −32768. Tỉ lệ thời gian = giá trị × 4e-05 (đọc từ tag `scales`). Max ~0,79 cho Mặt Trời và 1,0 cho Trái Đất.
  - `LPSR`: giá trị × 2.5e-05 + 0,5 → 0 hoặc 1 (vùng tối vĩnh cửu).
- **Horizons:** bước `1h` chạy được, 1 tháng trả 745 dòng. Cột đầu ra là `azimuth elevation` ngay sau ngày giờ và một ký tự cờ (ví dụ `2028-Jan-01 00:00 i 133.19 -2.11`).
- **Horizons ephemeris** (`COMMAND=301`, `CENTER=500@399`, `QUANTITIES=14,15,19,20`, `RANGE_UNITS=KM`, `CSV_FORMAT=YES`):
  - header ghi `Target pole/equ : MOON_ME {East-longitude positive}`;
  - cột: `ObsSub-LON, ObsSub-LAT, SunSub-LON, SunSub-LAT, r, rdot, delta, deldot`;
  - kinh độ trong khoảng 0…360 nên phải đổi sang −180…180; `r` và `delta` tính bằng km;
  - dòng tên cột nằm ở `$$SOE − 2`;
  - một quý khoảng 2.200 dòng, gọi theo quý chạy được; cả 9 quý mất khoảng 47 giây.
- **Horizons az/el tại điểm trên Mặt Trăng:** `CENTER=coord@301`, `COORD_TYPE=GEODETIC`, `SITE_COORD=lon,lat,alt_km`, `QUANTITIES=4`. Cột bắt đầu bằng `Azi` và `Elev`; trả về giá trị apparent, không có khúc xạ.
- **PGDA:** link thư mục `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/` trả 404, nhưng link tới từng file vẫn tải được. Danh sách file xem ở `https://pgda.gsfc.nasa.gov/products/90` và `/products/69`. Server hay ngắt kết nối giữa chừng (`Connection reset by peer`) nhưng hỗ trợ Range (206), nên `download_data.py` tự thử lại tối đa 5 lần và tải tiếp từ file `.part`.
- **Vercel link:** `vercel link` tự tạo `web/.env.local` chứa `VERCEL_OIDC_TOKEN`. File này là bí mật, đã gitignore.
- **Vercel xoá project:** `vercel project rm <name>` cần thêm `--confirm-name <name>`, và chỉ chạy khi người dùng đã duyệt.
- **Vercel public:** domain production `<project>.vercel.app` công khai, mở bằng tab ẩn danh không cần đăng nhập (đã kiểm tra).
- **Bundle:** khoảng 3,4 MB JS (gzip ~1 MB) vì import toàn bộ ECharts cộng three.js của globe.gl. Chấp nhận được; chỉ tối ưu khi thật sự cần.
- **ECharts 6 + theme dark:** nhãn trục y bị chồng ở hai đầu. Cần đặt `min`/`max` hoặc `interval` hợp lý khi có dữ liệu thật.
- **Raster mới (kiểm tra 14/11):** cùng `PGDA_CRS`, nodata `nan`, không có scale.
  - `LDSM_80S_80MPP_ADJ`: độ dốc tính bằng độ, 7600², 80 m.
  - `LPSR_80S_20MPP_ADJ`: giá trị 0/1, **30400²** (khoảng 3,7 GB float32), phải đọc theo cửa sổ.
  - `LDEM_60S_240MPP_ADJ`: độ cao tính bằng mét, 7760², 240 m, phủ ±931 km.
- **Hệ chiếu PGDA:** `+x` hướng về kinh độ 90°E, `+y` hướng về kinh tuyến 0°. Vẽ bản đồ với x sang phải, y lên trên.
- **LGRS:**
  - USGS T&M 11-E1 (2025, doi:10.3133/tm11E1) định nghĩa LTM, LPS, LGRS và ACC;
  - lưới 1 km của 9 vùng nằm trong McClernan 2024 (doi:10.5066/P1MEQ6UK);
  - bộ toàn cầu trên Astropedia nặng 12,5 GB, không dùng;
  - phương án dự phòng là package Python `lgrs` (SETI/USGS, Apache-2.0); đây là thư viện mới nên phải hỏi nhóm.
- **Vùng lớn:** Mons Mouton Plateau rộng khoảng ±58 km, có thể ra hơn 2.000 ô. Nếu file cells vượt 2 MB, báo nhóm trước khi đổi định dạng.
- **Lint:** không còn file khung nào có dòng `eslint-disable no-unused-vars`. Nếu cần bỏ qua một cảnh báo, đặt tại đúng dòng và ghi lý do.
- **Vite dev:** file JSON không tồn tại vẫn trả `index.html` với mã 200, nên phát hiện thiếu `regions.json` bằng cách bắt lỗi parse JSON (`loadRegions(false).catch(...)`), không dựa vào `response.ok`. Vercel thì trả 404.
- **Try/catch dự phòng:** đã xoá hết (audit 15/11). Không còn comment `shortcut:` trong `web/src` và `pipeline`; C5 gọi C1, C2, C4 thật.
- **Playwright MCP:** ảnh chụp chỉ lưu được trong thư mục dự án (`.playwright-mcp/`, đã gitignore), không lưu vào scratchpad.
- **Review bằng 4 subagent ECC (14/11)** (react-patterns, accessibility, tdd-workflow, python-patterns) đã sửa:
  - `nextCrossing` trả `Infinity` khi giá trị nằm đúng ngưỡng (hỏng đồng hồ đếm ngược);
  - `asin` ra NaN khi thiên thể ở đúng đỉnh đầu;
  - `replaceState` không debounce, có thể làm sập Safari;
  - tìm kiếm khi chưa tải đủ các vùng;
  - không có error boundary;
  - globe làm bundle đầu nặng 2,26 MB (giờ tải lười, bundle chính còn 250 kB);
  - bản đồ không chọn được bằng bàn phím (đã thêm danh sách Cell);
  - `check_web_data.py` cho qua dữ liệu sai (giờ kiểm tra phủ thời gian ephemeris, `xM/yM` so với lat/lon, ngưỡng lấy từ `common.py`, `validation.json`, file JSON lạ).
- **Quy ước phương vị** (chốt cho D4): k° tính từ **bắc địa lý tại ô**, không phải trục `+y` của bản đồ. Có test ở lon 90.
- **Chrome mới:** `scrollIntoView` trả về Promise. Không được trả về nó từ `useEffect` (React báo `destroy is not a function`); luôn bọc thân effect trong `{ }`.
- **globe.gl 2.x:** tạo bằng `new Globe(element)`, dọn bằng `globe._destructor()`. Callback truyền vào phải ổn định (`useCallback`), nếu không quả cầu sẽ bị dựng lại mỗi lần render.

### Dùng skill ECC trong dự án

| Việc | Skill |
|---|---|
| UI React/Vite/Tailwind | `react-patterns`, `frontend-patterns`, `vite-patterns`, `frontend-design-direction`, `make-interfaces-feel-better`, `accessibility` |
| Tra tài liệu globe.gl, ECharts, astronomy-engine | `documentation-lookup` (Context7) |
| Nghiên cứu nguồn NASA | `deep-research` (exa + firecrawl) |
| Pipeline Python | `python-patterns` |
| Test thuật toán lõi | `tdd-workflow` (dùng `node:test`, test hợp đồng đã viết sẵn) |
| Kiểm tra trước khi deploy hoặc nộp | `verification-loop`, `browser-qa` |
| Bài nộp | `frontend-slides` (≤ 7 slide), `ui-demo` + `video-editing` (video ≤ 30 s) |
| Commit | `git-workflow` |

Khi một skill ECC mâu thuẫn với skill này (TypeScript, Next.js, router, backend, coverage 80 %), **skill này thắng**. Đã xoá các skill không hợp stack: TypeScript, Next.js, FastAPI, Postgres, backend/API, Docker, ML, scraper, LLM cost, investor, product-lens, blueprint, market-research, design-system, coding-standards, error-handling, search-first, e2e-testing, remotion.

## Phần B — Spec (giống `CLAUDE.md`, sửa thì sửa cả hai)

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
