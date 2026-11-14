# Lunar Landing Site Navigator: ý tưởng "Window Finder"

NASA Space Apps Challenge 2026, Challenge 10 (CLPS). Tài liệu thiết kế cho nhóm, cập nhật 14/11/2026.

## 1. Một câu định vị

Người dùng nhập điểm hạ cánh đang dự kiến và giới hạn của sứ mệnh. Công cụ tìm những điểm và thời điểm hạ cánh tốt nhất trong cùng vùng, rồi cho kéo thanh thời gian để xem bảng xếp hạng thay đổi theo ngày hạ cánh.

Câu tiếng Anh cho slide: *"Tell us your landing spot and your mission's limits. We find the best nearby sites and dates, ranked hour by hour."*

## 2. Vì sao làm vậy (bám phần Background của đề)

- Đề nói thẳng: lịch sứ mệnh hay bị trễ, nên kỹ sư phải đánh giá nhanh "site khác trong cùng vùng" hoặc "ngày khác ở cùng site". Window Finder trả lời đúng hai câu này.
- Ở cực Nam, dời vài km hoặc vài ngày là nắng và liên lạc đổi hẳn.
- Quickmap, Moon Trek, Horizons đều mạnh nhưng khó dùng để so nhanh nhiều kịch bản.
- Điểm khác các đội: không chỉ báo % có nắng, mà quy ra "pin có sống được suốt sứ mệnh không", và tìm ngược từ yêu cầu thay vì bắt người dùng thử từng site.

## 3. Luồng sử dụng

### 3.1 Bản đồ chọn điểm

- Bản đồ 2D vùng cực Nam (chiếu stereographic) có 9 vùng ứng viên Artemis III. Mỗi vùng chia thành ô 1 km theo lưới LGRS của USGS.
- Chỉ tô màu các ô khả thi để hạ cánh (xem 5.3): không quá dốc, không nằm trong vùng tối vĩnh cửu. Ô không khả thi để xám.
- Có thêm ghim cho các site nổi tiếng (xem 5.5).
- Bấm vào một ô sẽ mở popup gồm:
  - ID ô, kinh độ, vĩ độ, độ cao, độ dốc.
  - Mặt Trời và Trái Đất ở thời điểm đang xem: góc cao, còn bao lâu tới lúc lặn.
  - Nút "Sao chép ID" và nút "Dùng làm điểm hiện tại" (điền ID vào form).

### 3.2 Form kịch bản

| Trường | Ví dụ | Ghi chú |
|---|---|---|
| Điểm hạ cánh hiện tại | ID ô `MAL-…` hoặc kinh/vĩ độ | Nhận cả toạ độ tuỳ ý (đề yêu cầu) |
| Khoảng ngày dự kiến | 01/01/2028 – 30/06/2028 | Tối đa 6 tháng mỗi lần chạy |
| Số ngày ở lại | 6 | Tiêu chí chọn vùng của NASA dùng khoảng 5,75–6,25 ngày |
| Tối liên tục tối đa | 24 giờ | "Tối" là khi lộ dưới 50% đĩa Mặt Trời |
| Mất liên lạc tối đa | 12 giờ | "Mất" là khi lộ dưới 50% đĩa Trái Đất |
| Công suất tấm pin tối đa | 1.000 W | Ở 1 AU, đĩa lộ hết, nắng chiếu vuông góc |
| Dung lượng pin | 10 kWh | Coi như pin đầy lúc hạ cánh |
| Mức tiêu thụ | 300 W | Trung bình, không đổi theo giờ |
| Kiểu tấm pin | Tự động | Đứng (hợp ở cực) hoặc nằm ngang (hợp ở xích đạo) |
| Phạm vi tìm | Cùng vùng | Cùng vùng, bán kính R km, hoặc cả 9 vùng |

Các số trong cột "Ví dụ" chỉ để minh hoạ, không phải thông số thật của tàu nào; giao diện phải ghi rõ điều này.

Có hai chế độ: **Đơn giản** dùng mẫu chọn sẵn và chỉ hỏi điểm, ngày, số ngày ở lại; **Chuyên gia** mở toàn bộ trường.

Không có trường "độ dốc xe leo được". Trường đó chỉ cần cho tính năng tìm đường đi của rover, mà tính năng này đã bỏ.

### 3.3 Kết quả sau khi bấm Submit

1. **Thanh trượt thời điểm hạ cánh** (bước 6 giờ) kèm nút Play.
   - Bản đồ tô màu từng ô theo kết quả ở thời điểm đang chọn: xanh là đạt, vàng là đạt nhưng sát ngưỡng (pin thấp nhất dưới 20%), đỏ là không đạt.
   - Bảng xếp hạng top 10 ô ở thời điểm đó cập nhật ngay khi kéo.
2. **Thẻ "Điểm hiện tại của bạn"**: đạt hay không và lý do; thời điểm đạt gần nhất; ô đạt gần nhất cách bao nhiêu km.
3. **Dải thời gian của điểm hiện tại**: mỗi thời điểm hạ cánh trong khoảng ngày được tô xanh hoặc đỏ (heatmap một hàng của ECharts).
4. **Top 10 cặp (ô, thời điểm) tốt nhất** trong toàn bộ khoảng ngày.

Bảng xếp hạng gồm các cột: hạng, ID ô, khoảng cách tới điểm hiện tại (km), pin thấp nhất (%), tối dài nhất (giờ), mất liên lạc dài nhất (giờ), % có nắng, % thấy Trái Đất, góc cao Mặt Trời trung bình, số giờ để sạc đầy lại, trạng thái.

Thứ tự xếp mặc định:

1. Ô đạt đứng trước ô không đạt.
2. Pin thấp nhất cao hơn đứng trước.
3. % thời gian vừa có nắng vừa thấy Trái Đất cao hơn đứng trước.
4. Gần điểm hiện tại hơn đứng trước.
5. Liên lạc liền mạch nhất.

Bấm tiêu đề cột để đổi cách xếp. Không dùng điểm tổng có trọng số, để người dùng luôn hiểu vì sao một ô đứng trên ô khác.

### 3.4 Màn hình chi tiết (bấm một dòng trong bảng)

- **Horizon view 2D**: trục ngang là phương vị 0–360°, trục dọc là góc cao. Vẽ bóng địa hình (chân trời 360°) cùng đường đi của Mặt Trời và Trái Đất suốt thời gian sứ mệnh, có con trỏ thời gian kéo được.
- **Đồng hồ đếm ngược**: "Mặt Trời lặn sau 3 giờ 20 phút", "Trái Đất lặn sau 18 giờ", "nắng trở lại sau …".
- **Góc cao Mặt Trời** hiển thị to, nổi bật (đề nhấn mạnh chỉ số này).
- **Biểu đồ pin theo giờ**, nền tô các đoạn có nắng, tối và mất liên lạc.
- **So sánh cạnh nhau với điểm hiện tại**: hai chân trời chồng lên nhau, kèm một câu giải thích, ví dụ "Dời 2,3 km sang ô X: tối dài nhất giảm từ 72 giờ còn 10 giờ vì sườn núi phía bắc thấp hơn 1,5°".
- Nút xuất CSV (chế độ Chuyên gia).

### 3.5 Quả cầu 3D (globe.gl)

- Mặt Trăng dùng texture của NASA, ghim các site nổi tiếng và 9 vùng.
- Từ site đang chọn, vẽ mũi tên chỉ hướng Mặt Trời và Trái Đất.
- Bấm vào vùng cực Nam thì chuyển sang bản đồ 2D.

### 3.6 Chế độ học (giáo viên, công chúng)

- Mỗi chỉ số có một câu giải thích bằng lời thường.
- Thẻ "Vì sao dời 1 km thay đổi nhiều": tự tìm cặp ô sát nhau có kết quả chênh nhau nhiều nhất, rồi so hai chân trời.
- Thẻ "Mặt Trăng khác Trái Đất ở đâu": không có khí quyển nên không có khúc xạ, bầu trời đen cả ban ngày; ở cực Nam Mặt Trời chỉ cao vài độ; một ngày Mặt Trăng dài khoảng 29,5 ngày Trái Đất.

## 4. Thuật toán

### 4.1 Nhật ký từng giờ của một ô

Với mỗi giờ t và mỗi ô c:

1. Tính góc cao và phương vị của Mặt Trời và Trái Đất tại ô (mục 4.3).
2. Lấy độ cao chân trời của ô ở đúng phương vị đó.
3. Tính phần đĩa Mặt Trời lộ ra (`sun_frac`), phần đĩa Trái Đất lộ ra (`earth_frac`), và hệ số nắng (`sun_factor`).

### 4.2 Khung trượt

Với mỗi ô c trong phạm vi tìm và mỗi thời điểm hạ cánh s (bước 6 giờ), khung là các giờ từ s tới s + số ngày × 24.

Các chỉ số trong khung:

- `longest_dark`: chuỗi giờ liền nhau dài nhất có `sun_frac < 0.5`.
- `longest_comm_loss`: chuỗi giờ liền nhau dài nhất có `earth_frac < 0.5`.
- `pct_sun`, `pct_earth`, `pct_both`: tỷ lệ số giờ có nắng, thấy Trái Đất, có cả hai.
- Mô phỏng pin:
  - Pin ban đầu bằng dung lượng.
  - Mỗi giờ: pin = min(dung lượng, pin + công suất tối đa × `sun_factor` − mức tiêu thụ).
  - `min_battery` là mức pin thấp nhất. Nếu pin chạm 0 thì ghi lại "hết pin ở giờ thứ …".
- `recharge_hours`: số giờ từ lúc pin thấp nhất tới lúc đầy lại, hoặc "không sạc đầy trong khung".
- `time_to_sunset`: số giờ từ lúc hạ cánh tới giờ tối đầu tiên.

Một ô đạt khi cả ba điều kiện đúng: `longest_dark ≤ tối tối đa`, `longest_comm_loss ≤ mất liên lạc tối đa`, và `min_battery > 0`.

### 4.3 Công thức

Hằng số: bán kính Mặt Trăng R = 1737,4 km; bán kính Mặt Trời 696.000 km; bán kính Trái Đất 6.371 km; 1 AU = 149.597.870,7 km.

**Vị trí ô** (kinh độ λ, vĩ độ φ, độ cao h tính bằng km):

```
P = (R + h) · (cos φ cos λ, cos φ sin λ, sin φ)
```

**Vị trí Mặt Trời hoặc Trái Đất** tính từ điểm dưới thiên thể (λb, φb) và khoảng cách D tới tâm Mặt Trăng:

```
B = D · (cos φb cos λb, cos φb sin λb, sin φb)
```

**Góc cao và phương vị tại ô:**

```
d    = B − P
up   = P / |P|
east = (−sin λ, cos λ, 0)
north = up × east
el = asin( d·up / |d| )
az = atan2( d·east, d·north )   (đổi về 0–360°, tính từ hướng Bắc theo chiều kim đồng hồ)
```

**Phần đĩa lộ ra** (gần đúng tuyến tính), với ρ là bán kính góc của đĩa (Mặt Trời khoảng 0,27°, Trái Đất khoảng 0,95°) và H là độ cao chân trời ở phương vị az:

```
frac = clamp( (el − H + ρ) / (2ρ), 0, 1 )
```

**Hệ số nắng:**

```
sun_factor = (1 AU / D_sun)² × sun_frac × hệ_số_tấm_pin
```

- Tấm pin đứng, xoay theo phương vị: `hệ_số_tấm_pin = cos(el)`.
- Tấm pin nằm ngang: `hệ_số_tấm_pin = max(sin(el), 0)`.
- Chế độ Tự động: |vĩ độ| ≥ 60° thì dùng tấm đứng, còn lại dùng tấm nằm ngang.

Công suất mỗi giờ = công suất tấm pin tối đa × `sun_factor`.

### 4.4 Khối lượng tính

- Một vùng có khoảng 225 ô. Với 6 tháng (730 thời điểm hạ cánh, bước 6 giờ) và khung 144 giờ, tổng cỡ 24 triệu bước, chạy được trong khoảng 1–2 giây.
- Cả 9 vùng (khoảng 2.000 ô) nặng hơn khoảng 10 lần, nên chạy trong Web Worker và hiện thanh tiến độ.
- Tính sẵn các mảng theo giờ của từng ô một lần, sau đó mới trượt khung trên các mảng đó.

## 5. Dữ liệu và tiền xử lý (Python, chạy một lần)

Thư viện: `requests`, `numpy`, `rasterio`, `geopandas`, `pyproj`.

### 5.1 Lịch thiên văn chung: `ephemeris.json`

- Gọi Horizons API: `COMMAND='301'`, `CENTER='500@399'`, `QUANTITIES='14,15,19,20'`, `STEP_SIZE='1h'`, `CSV_FORMAT='YES'`, từ 2027-01-01 tới 2029-01-31 (dư một tháng cuối để khung trượt không bị hụt). Nếu một lần gọi quá dài thì chia theo quý.
- Các mã cần lấy:
  - Mã 14: điểm dưới người quan sát. Với người quan sát ở tâm Trái Đất, đây là điểm dưới Trái Đất trên Mặt Trăng, và sự dịch chuyển của điểm này chính là libration.
  - Mã 15: điểm dưới Mặt Trời trên Mặt Trăng.
  - Mã 19: khoảng cách Mặt Trăng – Mặt Trời.
  - Mã 20: khoảng cách Trái Đất – Mặt Trăng.
- Mỗi giờ lưu: `t, earth_sub_lon, earth_sub_lat, earth_dist_km, sun_sub_lon, sun_sub_lat, sun_dist_au`. Đọc header kết quả để chắc đơn vị và tên cột.
- Kinh độ dùng kinh độ Đông dương, hệ toạ độ mean-Earth của Mặt Trăng.
- **Kiểm chứng bắt buộc**: chọn 2 ô, gọi Horizons trực tiếp (`COMMAND='10'` và `'399'`, `CENTER='coord@301'`, `SITE_COORD`, `QUANTITIES='4'`), rồi so góc cao và phương vị với cách tính vector ở 4.3. Sai lệch phải rất nhỏ (cỡ 0,1° trở xuống); nếu lớn hơn thì xem lại quy ước kinh độ và hệ toạ độ.
- **Phương án dự phòng** nếu cách dùng điểm dưới thiên thể không ổn: gọi Horizons lấy góc cao, phương vị trực tiếp cho tâm mỗi vùng và cho các site nổi tiếng (khoảng 30 lần gọi), các ô trong vùng dùng chung kết quả của tâm. Cách này kém chính xác hơn, lệch tới khoảng 0,25° ở mép vùng.

### 5.2 Lưới ô: từ USGS

- Dùng bộ lưới LGRS dạng ACC cho 9 vùng Artemis III; mỗi vùng có shapefile lưới 1 km, 100 m và 10 m. Không dùng bộ "Terrestrial Navigational Training Grids", vì đó là lưới tập huấn trên Trái Đất (UTM, WGS84).
- Đọc lưới 1 km bằng `geopandas`, lấy tâm ô rồi đổi sang kinh/vĩ độ Mặt Trăng. USGS khuyên dùng hệ toạ độ đã đăng ký như `IAU_2015:30100` hoặc `ESRI:104903`.
- ID ô có dạng `<mã vùng>-<nhãn ô 1 km>`. Mã vùng:

| Mã | Vùng |
|---|---|
| CAB | Peak near Cabeus B |
| HAW | Haworth |
| MAL | Malapert Massif |
| MMP | Mons Mouton Plateau |
| MMO | Mons Mouton |
| NR1 | Nobile Rim 1 |
| NR2 | Nobile Rim 2 |
| DGR | de Gerlache Rim 2 |
| SLP | Slater Plain |

- Nhãn ô lấy theo thuộc tính có sẵn trong shapefile (kiểm khi mở file); nếu không có thì tự đặt `r<hàng>c<cột>`.

### 5.3 Ô khả thi

- **Độ dốc**: PGDA 90 `LDSM_80S_80MPP_ADJ.TIF` (231 MB). Ô khả thi nếu trung vị độ dốc trong ô không vượt ngưỡng; ngưỡng mặc định 20°, theo bản đồ NASA trình bày cho Space Apps 2025 (tô đen vùng dốc trên 20°), chỉnh được trong code.
- **Vùng tối vĩnh cửu**: PGDA 90 `LPSR_80S_20MPP_ADJ.TIF` (148 MB). Ô có trên 50% diện tích là vùng tối vĩnh cửu vẫn hiện trên bản đồ, nhưng tô xám và ghi "không có nắng".
- Các file PGDA là Cloud-Optimized GeoTIFF, nên `rasterio` có thể đọc riêng từng cửa sổ quanh 9 vùng qua HTTP mà không cần tải cả file.

### 5.4 Chân trời từng ô: `cells_<mã vùng>.json`

- DEM: PGDA 90 `LDEM_80S_80MPP_ADJ.TIF` (181 MB) cho phần gần; `LDEM_60S_240MPP_ADJ.TIF` (210 MB) cho phần xa nằm ngoài 80°S.
- Bắn 360 tia (mỗi độ phương vị một tia), lấy mẫu dọc tia từ 100 m tới 150 km với bước tăng dần.
- Góc nâng của mỗi mẫu:

```
góc = atan2( h_mẫu − h_ô − cột − d² / (2R), d )
```

  trong đó d là khoảng cách ngang tới mẫu. Số hạng d²/(2R) là độ cong Mặt Trăng, nên chân trời tự gồm cả "mép mặt cầu" như đề nhắc. `cột` là độ cao đặt tấm pin hoặc anten, mặc định 2 m.
- Chân trời ở mỗi phương vị là góc lớn nhất dọc tia đó.
- Mỗi ô lưu: `id, lat, lon, h, slope, psr, horizon` (360 số nguyên, đơn vị 0,1°).

### 5.5 Site nổi tiếng: `sites.json`

Đề gợi ý danh sách gồm site Apollo, mục tiêu CLPS, sứ mệnh thương mại khác và sứ mệnh của các nước khác:

| Nhóm | Site |
|---|---|
| Apollo | Apollo 11, 12, 14, 15, 16, 17 |
| CLPS / thương mại | IM-1 (gần Malapert A), IM-2 (vùng Mons Mouton), Blue Ghost Mission 1 (Mare Crisium), IM-3 (Reiner Gamma, sắp tới) |
| Nước khác | Chang'e 3, 4, 5, 6; Chandrayaan-3; SLIM |

- Toạ độ lấy từ nguồn chính thức (LROC/NASA hoặc cơ quan vũ trụ tương ứng) và ghi vào References.
- Site nằm trong vùng phủ của DEM PGDA 90 (tới 60°S, ví dụ Chandrayaan-3) thì tính chân trời địa hình. Các site khác chỉ dùng chân trời mặt cầu (góc cao > 0°), và giao diện ghi rõ "chưa tính địa hình".

### 5.6 Kiểm chứng

- So % có nắng và % thấy Trái Đất của vài ô với bản đồ PGDA 69. PGDA 69 là trung bình 18,6 năm, còn mình chỉ tính 2 năm, nên chỉ so được về độ lớn.
- So một ô với công cụ Compute Visibility của QuickMap, chụp màn hình cho slide.
- So cách tính vector với Horizons như mục 5.1.

### 5.7 Dung lượng file

- `ephemeris.json`: khoảng 18.000 giờ × 7 số, cỡ 1–2 MB (Vercel tự nén khi gửi).
- `cells_*.json`: khoảng 2.000 ô × 360 số, cỡ 3–4 MB tổng. Tách theo vùng (khoảng 400 KB mỗi vùng) và chỉ tải vùng đang dùng.

## 6. Đối chiếu với yêu cầu của đề

### 6.1 Objectives

| Yêu cầu của đề | Tính năng đáp ứng |
|---|---|
| Interactive site selection and comparison: danh sách site nổi tiếng, toạ độ tuỳ ý, so sánh nhiều site | Lưới ô 1 km có ID, danh sách site nổi tiếng (5.5), nhập kinh/vĩ độ, bảng xếp hạng, so sánh cạnh nhau (3.4) |
| Date and time flexibility: chọn ngày giờ, xem thay đổi theo ngày Mặt Trăng và theo mùa | Khoảng ngày dự kiến, thanh trượt bước 6 giờ, dải thời gian 2 năm của điểm hiện tại (thấy rõ mùa) |
| Sun and Earth position visualization, thời gian còn lại tới sunset/Earthset | Horizon view 2D, đồng hồ đếm ngược (3.4), popup trên bản đồ (3.1) |
| Power and communication assessment: góc cao Mặt Trời, thời lượng có nắng, cửa sổ thấy Trái Đất | Góc cao hiển thị nổi bật, % có nắng, tối dài nhất, % thấy Trái Đất, mất liên lạc dài nhất, thêm mô phỏng pin |
| Multiple visualization approaches | Bản đồ 2D, horizon view, quả cầu 3D, biểu đồ pin, heatmap |
| Temporal dynamics: hoạt hình, timeline | Nút Play trên thanh trượt, con trỏ thời gian trong horizon view, đường đi của Mặt Trời và Trái Đất |
| Accessibility across skill levels | Chế độ Đơn giản và Chuyên gia, chế độ học (3.6) |

### 6.2 Potential Considerations

| Gợi ý của đề | Cách xử lý |
|---|---|
| Dùng Horizons hoặc dữ liệu tính sẵn | Horizons API, tính sẵn thành `ephemeris.json` |
| Dùng LOLA để có chân trời chính xác | Chân trời 360° từ DEM PGDA 90 |
| Không có khí quyển; chân trời do địa hình và mép mặt cầu | Không tính khúc xạ; số hạng d²/(2R) trong công thức chân trời |
| Góc cao Mặt Trời là chỉ số quan trọng | Hiển thị to; đưa vào hệ số tấm pin |
| Ưu tiên so sánh nhanh nhiều kịch bản | Tìm ngược, bảng xếp hạng, thanh trượt cập nhật tức thì |
| Thông báo rõ thời gian tới sunset/Earthset | Đồng hồ đếm ngược |
| Làm nổi bật khác biệt Mặt Trăng và Trái Đất | Thẻ "Mặt Trăng khác Trái Đất ở đâu" |
| Giải thích vì sao thay đổi nhỏ gây khác biệt lớn | Thẻ "Vì sao dời 1 km thay đổi nhiều", so sánh hai chân trời |
| Tính địa hình thật | Chân trời và độ dốc từ LOLA |
| Libration, biến thiên quỹ đạo Mặt Trăng | Điểm dưới Trái Đất (mã 14) đã gồm libration; khoảng cách thay đổi theo giờ (mã 19, 20) |
| Sườn dốc, hố sâu ở cực Nam | Bộ lọc độ dốc, lớp vùng tối vĩnh cửu |
| Hỗ trợ khi lịch thay đổi | Lõi của Window Finder: ngày khác cùng site, site khác cùng vùng |
| Công cụ giáo dục | Chế độ học |

## 7. Giới hạn (ghi trung thực trong bài nộp)

- Dữ liệu theo bước 1 giờ; đồng hồ đếm ngược nội suy tuyến tính nên có thể lệch vài phút tới cỡ một giờ.
- Phần đĩa lộ ra tính gần đúng tuyến tính.
- Chân trời tính tại tâm ô 1 km với DEM 80 m, không thấy đá tảng hay gờ nhỏ.
- Site ngoài vùng phủ DEM chỉ có chân trời mặt cầu.
- Mô hình pin đơn giản: tải không đổi, chưa tính nhiệt độ và suy giảm hiệu suất.
- "Thấy Trái Đất" chưa xét trạm mặt đất có đang thấy Mặt Trăng hay không.
- Không phải công cụ chính thức của NASA.

## 8. Kế hoạch làm

**Ngày 1 (14/11)**

- Dữ liệu (Python):
  - Sáng: tạo `ephemeris.json` và làm bước kiểm chứng vector với Horizons.
  - Chiều: lưới và chân trời cho một vùng (Malapert Massif).
  - Tối: chạy cho đủ 9 vùng.
- Web:
  - Khung app, bản đồ 2D một vùng (dùng dữ liệu giả trong lúc chờ), form kịch bản.
  - Web Worker tính khung trượt, bảng xếp hạng, thanh trượt.
- Mục tiêu cuối ngày 1: chạy được trọn luồng cho một vùng.

**Ngày 2 (15/11)**

- Horizon view, đồng hồ đếm ngược, biểu đồ pin, so sánh cạnh nhau.
- Site nổi tiếng, quả cầu 3D, chế độ học.
- Deploy Vercel, kiểm chứng với PGDA 69 và QuickMap.
- Slide hoặc video tiếng Anh, trang project tiếng Anh.
- Nộp sớm vài giờ trước khi cổng đóng (23:59 ngày 15/11).

Nếu trễ, bỏ theo thứ tự: quả cầu 3D, chế độ học, phạm vi "cả 9 vùng".

## 9. Bài nộp

- **Space Agency Data**: JPL Horizons, LOLA (PGDA 90, PGDA 69), lưới LGRS của USGS, texture Mặt Trăng của NASA.
- **References**: liệt kê mọi nguồn ở mục 10, và ghi rõ phần nào có AI hỗ trợ, dùng như thế nào.
- **Demo**: video 30 giây hoặc tối đa 7 slide.

## 10. Nguồn

- Đề bài: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
- Horizons API: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- Horizons manual (mã QUANTITIES): https://ssd.jpl.nasa.gov/horizons/manual.html
- PGDA 90, DEM, độ dốc, vùng tối vĩnh cửu cực Nam: https://pgda.gsfc.nasa.gov/products/90
- PGDA 69, bản đồ chiếu sáng và tầm nhìn Trái Đất trung bình: https://pgda.gsfc.nasa.gov/products/69
- Lưới LGRS dạng ACC cho 9 vùng Artemis III (USGS): https://www.sciencebase.gov/catalog/item/671a6fa8d34efed5620f89f8
- Chín vùng ứng viên và tiêu chí chọn (LPSC 2026): https://ntrs.nasa.gov/citations/20250011660
- Tài liệu NASA về HLS cho Space Apps 2025 (ngưỡng độ dốc, yêu cầu chiếu sáng và liên lạc): https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf
- Texture Mặt Trăng, NASA SVS: https://svs.gsfc.nasa.gov/4720
- Công cụ đối chiếu: QuickMap https://quickmap.lroc.im-ldi.com , Moon Trek https://trek.nasa.gov/moon/
