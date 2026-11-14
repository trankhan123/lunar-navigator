# Bản đồ cực Nam mới: bản đồ theo thời gian + atlas gọn (W2 v2)

Ngày 14/11/2026 · Trạng thái: **chờ duyệt** (đã qua buổi soát của người xây dựng) · Thay cho `web/src/components/SouthPoleMap.jsx` hiện tại.

## 1. Mục đích và lý do

- **Người dùng:** người lập kế hoạch sứ mệnh (chính); giáo viên, công chúng và giám khảo Space Apps.
- **Lý do, theo lời người dùng:** "khi một người lập kế hoạch sứ mệnh mở bản đồ này, mình muốn bọn họ có trải nghiệm user friendly và các dạng biểu đồ, map kiến thức trực quan nhất có thể, từ đó nổi trội trong các sản phẩm cùng loại".
- **Điểm nhấn, người dùng chọn:** *bản đồ theo thời gian* làm phần chính, cộng *atlas gọn*.
- **Điều phải thấy ngay:** ô 1 km nào có nắng, ô nào thấy Trái Đất, vào giờ nào, và vì sao (địa hình). NavLunar và QuickMap không cho thấy điều này theo từng giờ, từng ô. Lớp ngày/đêm của NavLunar còn bỏ qua địa hình.
- **Tham khảo:** bản đồ cực Nam của navlunar.com, gồm:
  - kéo và phóng to;
  - đánh dấu các vùng Artemis;
  - lưới LGRS;
  - bảng View có các lớp Labels, Missions, LOLA relief, Illumination, PSRs;
  - lớp ngày/đêm theo giờ;
  - chú giải thu gọn được, dòng ghi nguồn.

## 2. Mục tiêu, không làm, chống mục tiêu

**Mục tiêu:**

1. Kéo và phóng to mượt bằng chuột, chạm (chụm hai ngón) và nút +/−. Đi từ tổng quan cực Nam xuống vùng, rồi xuống ô.
2. Thanh thời gian kèm nút Play: tô lại mọi ô theo Mặt Trời và Trái Đất tại giờ đang chọn, dùng chân trời địa hình thật của từng ô.
3. Lớp "% thời gian trong khoảng ngày của bạn" (nắng, Trái Đất) cho cả 9 vùng, dùng cùng mô hình với bảng xếp hạng.
4. Lớp phủ dữ liệu NASA, ghi rõ nguồn và phạm vi:
   - % nắng và % thấy Trái Đất của PGDA 69 (60 m, chỉ từ 85°S vào cực);
   - vùng tối vĩnh cửu (PGDA 90, 20 m).
5. Rê chuột vào ô thì hiện một thẻ: mã ô, biểu đồ mini nắng/Trái Đất trong thời gian ở lại, và vài con số chính.
6. Hướng và độ cao Mặt Trời/Trái Đất tại giờ đang chọn, có mũi tên chỉ hướng trên bản đồ, để người xem hiểu vì sao bóng đổ như vậy.
7. Chú giải đổi theo lớp đang bật; dòng ghi nguồn; nhãn MOCK giữ nguyên.
8. Màu kết quả tìm kiếm (đạt / sát ngưỡng / không đạt, kèm ký hiệu ✓ ! ✕) vẫn là một lớp.

**Không làm:**

- đường đi rover;
- địa hình 3D;
- bản đồ cả Mặt Trăng;
- tile ảnh;
- đồng hồ "now" theo giờ thực, vì ephemeris chỉ có 2027-01 → 2029-01;
- nhãn tên miệng hố: chỉ làm nếu còn giờ, và phải lấy từ danh mục tên IAU/USGS (nguồn mới), không tự gõ toạ độ.

**Chống mục tiêu** (xảy ra là thất bại dù vẫn "chạy được"):

- hoạt ảnh giật hoặc làm đơ tab;
- giao diện rối, che mất bảng xếp hạng hay form;
- trộn dữ liệu NASA 60 m với mô hình 1 km của mình mà không ghi rõ;
- bịa dữ liệu hay nhãn;
- làm hỏng luồng đang có (popup → *Use as current point* → tìm → kết quả → chi tiết), chọn ô bằng bàn phím, hay nhãn MOCK;
- không dùng được trên điện thoại 390 px.

## 3. Ràng buộc

- **Stack:**
  - React 19 (JavaScript), Tailwind 4, bản đồ vẽ bằng SVG;
  - thư viện mới duy nhất: `d3-zoom` (cùng `d3-selection` nếu cần). Người dùng đã đồng ý thêm thư viện, với điều kiện cập nhật `package.json`, bảng stack trong `CLAUDE.md` và Part B của skill (hai chỗ này phải giống hệt), `REFERENCES.md`, `DATA_SOURCES.md`, README;
  - **khoá phiên bản chính xác:**
    - dùng `d3-zoom` 3.0.0 và chuỗi phụ thuộc ở các bản 2021–2022: `d3-selection` 3.0.0, `d3-drag` 3.0.0, `d3-transition` 3.0.1, `d3-dispatch` 3.0.1, `d3-interpolate` 3.0.1, `d3-color` 3.1.0, `d3-ease` 3.0.1, `d3-timer` 3.0.1;
    - ghim bằng `overrides` trong `package.json`;
    - lý do: cả chuỗi d3 ra bản vá ngày 03/11/2026, sau 5 năm im lặng. Các bản đó trông hợp lệ (GitHub Actions trusted publisher, không có script cài đặt), nhưng mới được 11 ngày.
- **Logic:** mọi logic mới đặt trong `web/src/core/` dưới dạng hàm thuần, có test `node --test` viết trước (TDD). Logic mới gồm: giá trị và màu theo lớp, % theo khoảng ngày, đổi phương vị sang góc trên bản đồ, chọn mức phóng.
- **Kích thước file:** JSON < 2 MB, PNG ≤ 1 MB. Ảnh mới do D8 (`pipeline/export_map_background.py`, rasterio) sinh ra. Đổi định dạng `maps.json` thì sửa README và checker cùng lúc.
- **Hiệu năng:**
  - tô lại ≤ 930 ô mỗi khung hình trong < 16 ms; Play chạy khoảng 4–8 khung mỗi giây;
  - lớp "% theo khoảng ngày" tính trong Web Worker, không chặn giao diện;
  - bundle chính tăng < 30 kB gzip.
- **Giao diện:** chữ tiếng Anh. Tốt trên laptop, dùng được trên điện thoại 390 px. Hỗ trợ bàn phím, `aria`, đủ tương phản, và tôn trọng `prefers-reduced-motion`.
- **Toạ độ:**
  - mọi thứ dùng mét theo `PGDA_CRS` (`xM`, `yM`, `boundsM`); bản đồ hướng lên phía kinh tuyến 0;
  - phương vị k (theo chiều kim đồng hồ từ Bắc địa phương) của một ô có kinh độ λ chỉ theo hướng `(sin(k+λ), cos(k+λ))` trên bản đồ (README D4).

## 4. Các cách đã cân nhắc

| Cách | Được | Mất |
|---|---|---|
| **A. SVG + d3-zoom** ✅ *người dùng chọn 14/11* | Nhanh làm nhất, ít rủi ro; giữ được popup, chọn ô bằng bàn phím và màu kết quả; mọi thứ đã sẵn theo mét PGDA | Không có tile; ảnh toàn cực (500 m/px) mờ khi phóng thật gần, lúc đó ảnh vùng 80 m thay vào |
| B. Leaflet + Proj4Leaflet | Cảm giác bản đồ kéo/thả quen thuộc như NavLunar (quán tính, thước tỉ lệ) | 2–3 thư viện; phải khai báo phép chiếu cực riêng; cắt tile; viết lại component, popup và cách chọn ô |
| C. deck.gl (WebGL) | Rất mượt, mở được sang 3D | Nặng (khoảng 300 kB trở lên), khó, quá mức cần cho khoảng 900 ô mỗi vùng |

## 5. Thiết kế đã chốt

### 5.1 Bố cục

```
Desktop                                                   Phone (390 px)
┌──────────────────────────────────────────┬──────────┐  ┌──────────────────┐
│ South pole › Malapert Massif  [find…][+][−]│ Scenario │  │ breadcrumb [+][−]│
│ ┌──────────────────────────────┐ ┌───────┐ │  form    │  │ ┌──────────────┐ │
│ │ ☀ Sun 112°, 1.4° high        │ │LAYERS │ │ (giữ như │  │ │     map      │ │
│ │ 🜨 Earth 2°, 4.1° high  [card]│ │◉ Sun  │ │  hiện    │  │ └──────────────┘ │
│ │      1 km cells on relief    │ │○ Earth│ │  nay)    │  │ [Layers ▾]       │
│ │   ↗ arrows to Sun / Earth    │ │○ % Sun│ │          │  │ ▶ time ━━●━━━━   │
│ │                    [overview]│ │☐ NASA │ │          │  │ legend           │
│ └──────────────────────────────┘ └───────┘ │          │  │ scenario form    │
│ ▶ 2028-01-03 18:00 UTC ━━━━●━━━━━ [1 h|6 h]│          │  └──────────────────┘
│ legend · sources                           │          │
└──────────────────────────────────────────┴──────────┘
```

Bản phác tương tác đã cho người dùng xem trong cuộc trò chuyện ngày 14/11, và người dùng đã duyệt.

### 5.2 Một bản đồ, hai mức phóng

- Một khung SVG duy nhất theo mét PGDA, phủ toàn cực Nam (±304 km); `d3-zoom` biến đổi nhóm nội dung.
- **Mức tổng quan:**
  - ảnh `south_pole.png` (500 m/px);
  - khung của 9 vùng theo `boundsM`, kèm tên vùng;
  - ghim các site (24 site trong `sites.json`) nằm trong khung.
- **Mức vùng:**
  - ảnh nền 80 m của vùng, các ô 1 km;
  - chỉ vẽ ô của vùng đang chọn (≤ 930 ô) để giữ tốc độ.
- **Chuyển giữa hai mức:**
  - bấm vào khung vùng thì phóng mượt tới `boundsM` của vùng đó và nạp ô nếu chưa có;
  - đường dẫn "South pole › <Region>" để quay lại mức tổng quan;
  - danh sách chọn vùng và danh sách chọn ô (cho bàn phím) giữ như hiện tại.
- Bản đồ nhỏ tổng quan ở góc cho biết đang xem chỗ nào.
- **Bản đồ mở ra ở đâu** (quyết định sau buổi soát, xem mục 9):
  - link không có ô và không có vùng: mở ở mức tổng quan;
  - link có ô (điểm hiện tại hoặc ô đang chọn): mở thẳng vào vùng của ô đó.
- **Mức tổng quan cũng đổi theo giờ:**
  - 9 điểm đánh dấu tâm vùng được tô theo trạng thái Mặt Trời / Trái Đất tại `mapHour`, dùng cùng các mức màu với lớp "now";
  - tính bằng C1/C2 trên site tâm vùng, vì 9 site này đã có chân trời D4 trong `sites.json`;
  - bấm Play là thấy cả cực Nam đổi theo giờ;
  - thẻ hướng Mặt Trời / Trái Đất chỉ hiện khi đã vào một vùng.
- **Ô tìm kiếm `[find…]`** (P2):
  - tìm vùng, site và mã ô của chính app (ví dụ `MAL-AZSWU`), không tìm tên miệng hố;
  - mã ô bắt đầu bằng mã vùng, nên khi gõ mã ô thì nạp file ô của vùng đó lúc cần. Không cần file chỉ mục mới, không đổi hợp đồng dữ liệu.

### 5.3 Thời gian

- State riêng `mapHour` (chỉ số giờ của ephemeris).
  - Khởi tạo từ `landingTime` nếu đã có, nếu chưa thì `startDate` 00:00.
  - Thanh trượt bước 1 giờ trong khoảng ngày của kịch bản.
- Nút Play tự tăng giờ. Có lựa chọn bước 1 h / 6 h mỗi khung.
- Ở màn Kết quả, bản đồ đi theo thanh "thời điểm hạ cánh" (bước 6 h) như hiện nay.

### 5.4 Lớp

**Lớp màu chính:** chọn một lớp (radio), tô màu cho ô.

| Lớp | Giá trị mỗi ô |
|---|---|
| Sunlight now | `diskFraction` Mặt Trời tại `mapHour`: 3 mức, gồm cả đĩa trên chân trời, một phần (vẫn tính là "thấy" khi ≥ 0,5), và trong bóng |
| Earth in view now | `diskFraction` Trái Đất ≥ 0,5 hay không |
| Sun and Earth now | 4 mức: cả hai / chỉ nắng / chỉ Trái Đất / không có gì |
| % sunlight (your dates) | `fractionSun` trên khoảng `startDate`…`endDate`, thang màu liên tục an toàn cho người mù màu |
| % Earth in view (your dates) | `fractionEarth` trên cùng khoảng |
| Search result | đạt / sát ngưỡng / không đạt tại thời điểm hạ cánh (✓ ! ✕); chỉ có sau khi tìm |
| Feasibility | xanh / xám như hiện nay |

- Lớp mặc định: *Sunlight now* ở màn Map; *Search result* ở màn Kết quả.
- Ở mọi lớp, ô không khả thi luôn có dấu riêng (viền hoặc gạch chéo xám) để vẫn nhận ra được.

**Lớp phủ ảnh:** bật/tắt bằng checkbox, có độ trong suốt.

- Relief (hillshade): mặc định bật.
- NASA % sunlight (PGDA 69).
- NASA % Earth in view (PGDA 69).
- Permanent shadow (PGDA 90 LPSR).
- Nhãn ô LGRS: chỉ hiện khi phóng đủ gần.

**Phạm vi PGDA 69:** raster là một ô vuông ±151,7 km quanh cực (khoảng 85°S trở vào), đã đếm trên dữ liệu thật:

- phủ đủ: HAW, MAL, MMO, NR1, DGR, SLP;
- phủ một phần: NR2 (84/420 ô), MMP (353/900 ô);
- không phủ: CAB.

Lớp NASA chỉ vẽ ở chỗ có dữ liệu. Khi bật lớp này, ghi chú hiện ra:

- vùng không phủ: "NASA data covers about 85°S to the pole; not available for <Region>.";
- vùng phủ một phần: "NASA data covers only part of <Region>."

### 5.5 Thẻ rê chuột và popup

- **Desktop:** rê chuột vào ô thì hiện thẻ nhỏ gồm:
  - mã ô và khả thi hay không;
  - biểu đồ mini SVG (sparkline) nắng và Trái Đất trong `stayDays`, tính từ `mapHour`;
  - % nắng và % thấy Trái Đất trong khoảng đó; độ dốc.
- **Bấm hoặc chạm vào ô:** mở `CellPopup` hiện có, như hiện nay.

### 5.6 Hướng Mặt Trời và Trái Đất

- Thẻ ở góc ghi phương vị và độ cao của Mặt Trời và Trái Đất tại `mapHour`, đo ở ô đang chọn (nếu chưa chọn ô thì đo ở tâm vùng).
- Hai mũi tên trên bản đồ chỉ hướng đó; góc trên bản đồ = phương vị + kinh độ (mục 3).

### 5.7 Chú giải và nguồn

- Chú giải đi theo lớp chính và các lớp phủ đang bật. Màu luôn có chữ đi kèm, không bao giờ chỉ dựa vào màu.
- Dòng nguồn ghi: LOLA PGDA 90 (80 m), PGDA 69 (60 m, 85°S+), USGS LGRS, JPL Horizons.

### 5.8 Dữ liệu mới (D8)

- Với mỗi vùng nằm trong phạm vi dữ liệu, sinh thêm ảnh PNG RGBA:
  - `<CODE>_sun.png`: % nắng PGDA 69 (giá trị gốc × 4e-5 = tỉ lệ 0–1);
  - `<CODE>_earth.png`: % thấy Trái Đất PGDA 69;
  - `<CODE>_psr.png`: pixel PSR tô màu, phần còn lại trong suốt.
- `maps.json` thêm các kind `earth-visibility` và `psr` (kind `sun-visibility` đã có trong hợp đồng). Vùng ngoài phạm vi thì không có mục. README và checker cập nhật theo.

### 5.9 Tính toán

- **Mỗi khung hình:** với mỗi ô của vùng đang xem, tính vị trí Mặt Trời và Trái Đất tại một giờ, dùng C1 `computeSunTrack` / C2 `computeEarthTrack` với `hourCount = 1`.
- **% theo khoảng ngày:** tính trong Worker (cùng kiểu với `windowSearchWorker.js`), cache theo (vùng, `startDate`, `endDate`). Ước tính khoảng 1–2 s cho 900 ô × 6 tháng.
- **Logic cần test trước (TDD):**
  - giá trị → mức → màu theo lớp;
  - % theo khoảng ngày;
  - phương vị → góc bản đồ;
  - phạm vi phủ của PGDA 69 (85°S).

### 5.10 Thay vào đâu

- Component mới thay `SouthPoleMap` ở cả màn Map & scenario và màn Kết quả. Phải giữ nguyên hành vi hiện có:
  - chọn ô, ô hiện tại có viền vàng;
  - màu kết quả;
  - popup, đọc được bằng bàn phím.
- `SouthPoleMap.jsx` cũ bị xoá khi bản mới chạy đủ.

## 6. Để lại cho người xây dựng

- tên component và hàm, cách chia file;
- giá trị màu cụ thể (phải phân biệt được với người mù màu, trên nền tối);
- tốc độ Play; ngưỡng phóng để hiện nhãn ô;
- cách cache; breakpoint cho điện thoại;
- dùng `d3-transition` hay tự nội suy cho hiệu ứng phóng.

## 7. Thứ tự ưu tiên khi thiếu giờ

1. **P1:**
   - kéo/phóng; tổng quan → vùng; mở đúng chỗ theo link;
   - điểm tâm vùng đổi theo giờ ở mức tổng quan;
   - thanh thời gian + Play;
   - lớp *Sunlight now*, *Earth in view now* và *Sun and Earth now*;
   - chú giải; giữ luồng cũ.
2. **P2:**
   - các lớp % theo khoảng ngày;
   - thẻ rê chuột;
   - thẻ hướng và mũi tên;
   - ô tìm kiếm.
3. **P3:**
   - lớp NASA và PSR (D8);
   - nhãn ô LGRS;
   - bảng lớp gọn cho điện thoại.

## 8. Kiểm tra

- Test `node --test` cho mọi logic mới, viết trước; giữ xanh toàn bộ `npm test`, `npm run lint`, `npm run build`, và `check_web_data.py` cho cả dữ liệu thật lẫn mock.
- Playwright ở desktop và 390 px:
  - kéo/phóng; tổng quan → vùng → ô;
  - Play;
  - đổi lớp;
  - rê chuột và popup;
  - luồng tìm → kết quả → chi tiết;
  - bàn phím.
- Đo thời gian tô lại mỗi khung hình với vùng HAW (930 ô).

## 9. Sau buổi soát của người xây dựng (14/11)

Một agent "người xây dựng" đã đọc bản này và hỏi 3 câu. Cách xử lý:

1. **Quỹ thời gian.** Người dùng đã trả lời trong cuộc trò chuyện: "bạn không cần sợ sẽ trễ giờ tại nhóm mình cũng gần xong rồi".
   - Kế hoạch đủ P1–P3, làm theo thứ tự P1 → P3, sao cho sau mỗi bước vẫn có bản chạy được (test, lint, build xanh, deploy được).
   - Phần Python của D8 chạy song song với phần web.
   - Xoá `SouthPoleMap` cũ khi bản mới đã qua toàn bộ mục 8.
2. **Bản đồ mở ra ở đâu, và mức tổng quan có đổi theo giờ không:** *quyết định của Claude*, người dùng có thể đổi khi duyệt (mục 5.2).
3. **Ô tìm kiếm tìm gì:** *quyết định của Claude*, người dùng có thể đổi khi duyệt. Tìm vùng, site và mã ô; không tìm tên địa danh; mức P2 (mục 5.2).

Người xây dựng tự quyết, và chấp nhận như vậy:

- ở màn Kết quả, thời gian của bản đồ đi theo thanh thời điểm hạ cánh;
- ngưỡng của các mức nắng;
- cách vẽ khi PGDA 69 chỉ phủ một phần vùng.

Bản phác tương tác mà người dùng duyệt không lưu trong repo; mọi phần tử của nó đã được mô tả ở mục 5.1–5.7.
