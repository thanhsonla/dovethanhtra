# 04. Quy tắc đo, tính toán và đối chiếu

## 1. Nguyên tắc chung

1. Geometry gốc và dữ liệu nhập gốc không bị thay thế.
2. Kết quả chính thức được tính phía máy chủ.
3. Mỗi kết quả lưu mã quy tắc, phiên bản, đầu vào, đầu ra và thời điểm tính.
4. Đơn vị lưu chuẩn: mét, mét vuông, mét khối, số lượng, tấn, lượt và tấn.km; giao diện có thể hiển thị km/ha.
5. Không cộng bản nháp, bản bị thay thế hoặc bản xóa mềm.
6. Chồng lặp phải được phát hiện trước khi cộng tổng, nhưng không tự động trừ nếu người dùng chưa xác nhận.
7. `capture_draft` chỉ hiển thị số đo tạm và không có kết quả chính thức. Sau khi
   phân loại, máy chủ mới tạo measurement, áp quy tắc/version và đưa bản confirmed
   vào tổng.
8. Luồng nhập nhanh có thể ẩn hệ số nhưng không được tự đặt hệ số nghiệp vụ. Với
   point/line/area cơ bản, máy chủ lưu số lượng, mét hoặc mét vuông gốc; công thức có
   biến bắt buộc chỉ được xác nhận sau khi người dùng bổ sung đủ đầu vào.
9. Vùng người dùng chủ động chọn **Bớt** được biểu diễn bằng interior ring của
   Polygon, không phải một số âm chỉ tồn tại ở giao diện. Vùng phải nằm hoàn toàn
   trong outer ring và không giao vùng bớt khác; thay đổi tạo phiên bản measurement
   mới để giữ hình học trước đó và audit.

## 2. Kiểu đo cơ bản

### RULE-COUNT-1 — Số lượng

`quantity = count × unit_factor`

Áp dụng cho cây, cột đèn, bộ đèn, điểm tập kết. `count` có thể là số đối tượng geometry hoặc số lượng nhập có bằng chứng.

### RULE-LENGTH-1 — Chiều dài địa lý

`base_length_m = ST_Length(normalized_geometry::geography)`

Kết quả mặc định là mét. Nếu công tác tính cả hai bên đường:

`quantity_m = base_length_m × side_factor`

`side_factor` thường là 1 hoặc 2 nhưng phải nhập/được cấu hình, không suy đoán.

### RULE-AREA-1 — Diện tích địa lý

`base_area_m2 = ST_Area(normalized_geometry::geography)`

Với Polygon có interior ring, PostGIS tính trực tiếp:

`base_area_m2 = outer_area_m2 - Σ(interior_ring_area_m2)`

Diện tích quy đổi theo tần suất:

`quantity_m2_period = base_area_m2 × frequency × occurrence_count`

Không dùng tần suất nếu chỉ cần diện tích hiện trạng tại thời điểm kiểm tra.

### RULE-VOLUME-1 — Thể tích quy đổi

`quantity_m3 = length_m × width_m × depth_m × shape_factor`

Áp dụng cho nạo vét rãnh hoặc vật liệu. `width_m`, `depth_m`, `shape_factor` là đầu vào bắt buộc, kèm nguồn đo.

### RULE-COMPOSITE-1 — Công thức tổng hợp

Mỗi công tác composite có expression được whitelist, không chạy mã tùy ý. Ví dụ:

`quantity = area_m2 × frequency_per_day × service_days`

Mọi biến phải khai báo kiểu, đơn vị, giới hạn và bắt buộc/không bắt buộc.

## 3. Quy tắc theo nhóm dịch vụ

### 3.1. Vệ sinh môi trường

#### Quét đường theo chiều dài

`Q = Σ(length_i_m × side_factor_i × frequency_i × service_days_i)`

Đơn vị có thể là m.lần hoặc quy đổi theo biểu mẫu hợp đồng. Phải lưu riêng chiều dài hình học và hệ số, không chỉ lưu kết quả cuối.

#### Quét đường/hè theo diện tích

`Q = Σ(area_i_m2 × frequency_i × service_days_i)`

Nếu diện tích được suy từ chiều dài và bề rộng:

`area_i_m2 = length_i_m × effective_width_i_m`

Phần mềm phải đánh dấu phương pháp `derived_from_length_width`, khác với polygon đo trực tiếp.

#### Thu gom tại điểm

`Q_point = count_points` hoặc `Q_ton = Σ(weight_i_ton)`.

Không tự suy khối lượng rác từ số điểm nếu chưa có hệ số được phê duyệt trong hồ sơ.

### 3.2. Vận chuyển và xử lý rác

#### Cự ly một tuyến

- `D_one_way_km = route_distance_m / 1000`.
- `D_effective_km = D_one_way_km × return_factor`.
- `Vehicle_km = D_effective_km × trip_count`.
- `Ton_km = D_effective_km × transported_weight_ton`.

`return_factor` không mặc định bằng 2 cho mọi hợp đồng; cho phép 0, 1, 2 hoặc giá trị cấu hình có giải trình.

#### Cự ly bình quân gia quyền

`D_weighted_km = Σ(D_i_km × Q_i_ton) / Σ(Q_i_ton)`.

Nếu `ΣQ_i = 0`, không tính và trả cảnh báo `MISSING_TRANSPORT_WEIGHT`.

#### Tuyến nhiều chặng

Tách thành các leg:

`collection_start → collection_points → transfer_station → treatment_facility → depot(optional)`.

Mỗi leg lưu khoảng cách riêng. Báo cáo phải chỉ rõ chặng nào được tính vào khối lượng thanh toán/đối chiếu.

#### Thứ tự ưu tiên nguồn cự ly

Không tự lựa chọn nguồn thay người dùng. Khi so sánh, hiển thị song song:

1. Cự ly tài liệu/hồ sơ.
2. Cự ly người dùng tự vẽ.
3. Cự ly bộ định tuyến.
4. Cự ly GPS.

Nguồn dùng làm “khối lượng kiểm tra” phải được chủ hồ sơ xác nhận và ghi lý do.

### 3.3. Cây xanh, hoa cảnh

- Cây đơn lẻ: số điểm hợp lệ sau rà soát trùng.
- Hàng cây: số cây từ điểm; chiều dài tuyến chỉ là chỉ tiêu phụ.
- Cắt cỏ/thảm hoa: diện tích polygon hoặc chiều dài × bề rộng.
- Cắt tỉa: `Q = số cây × số lần`, kèm loại cây/nhóm kích thước nếu quy định.
- Tưới: `Q = diện tích hoặc số cây × tần suất × số ngày`; không suy thể tích nước nếu thiếu định mức.

Thuộc tính gợi ý: loài/nhóm cây, đường kính thân, chiều cao, tình trạng, kiểu chăm sóc, ngày kiểm tra.

### 3.4. Điện chiếu sáng

- Cột đèn: số điểm.
- Bộ đèn: tổng số bộ theo thuộc tính mỗi cột; có thể khác số cột.
- Cáp/đường dây: chiều dài tuyến.
- Tủ điều khiển: số điểm.
- Duy trì vận hành: `số thiết bị × số ngày/tháng`, nếu công thức hợp đồng yêu cầu.

Không suy số bộ đèn từ số cột nếu chưa nhập thuộc tính hoặc hệ số có căn cứ.

### 3.5. Chỉnh trang đô thị khác

- Sơn bó vỉa: chiều dài × số mặt/số lớp nếu có.
- Nạo vét rãnh: chiều dài hoặc thể tích.
- Duy trì biển báo: số điểm.
- Sửa chữa vỉa hè: diện tích polygon.
- Trang trí đô thị: điểm, tuyến hoặc số lượng tùy loại.

## 4. Chồng lặp và phạm vi

### RULE-OVERLAP-1 — Tuyến chồng lặp

Tạo buffer theo dung sai cấu hình, tính phần giao và tỷ lệ trên tuyến ngắn hơn. Cảnh báo khi vượt ngưỡng; không tự trừ.

### RULE-OVERLAP-2 — Vùng chồng lặp

`overlap_ratio = intersection_area / min(area_a, area_b)`.

Ngưỡng mặc định chỉ là cấu hình khởi tạo; người dùng được thay đổi theo loại công tác.

### RULE-BOUNDARY-1 — Ngoài địa bàn

Tính phần geometry ngoài `boundary_snapshot`. Hiển thị diện tích/chiều dài ngoài ranh giới và yêu cầu xác nhận nếu công tác liên huyện hoặc địa giới chưa chính xác.

## 5. GPS và lọc nhiễu

- Lưu tọa độ, thời gian, accuracy, altitude/speed nếu có.
- Điểm vượt ngưỡng accuracy được đánh dấu, không xóa khỏi raw track.
- Normalized track có thể bỏ điểm nhảy bất thường theo quy tắc phiên bản hóa.
- Cả chiều dài raw và normalized được lưu để so sánh.
- Nếu thời gian giữa hai điểm quá lớn, tách segment thay vì nối thẳng.

## 6. Đối chiếu

Với nguồn (S) và kết quả kiểm tra (I):

- `difference = I - S`.
- `absolute_difference = |I - S|`.
- `difference_percent = (I - S) / S × 100`, nếu `S ≠ 0`.

Nếu `S = 0`, hiển thị chênh lệch tuyệt đối và trạng thái `NO_SOURCE_BASELINE`; không hiển thị phần trăm vô nghĩa.

Ngưỡng cảnh báo có hai thành phần:

- Ngưỡng tuyệt đối theo đơn vị.
- Ngưỡng tỷ lệ phần trăm.

Cảnh báo kích hoạt nếu một hoặc cả hai điều kiện theo cấu hình. Cảnh báo không đồng nghĩa với kết luận sai phạm.

## 7. Làm tròn

- Lưu giá trị không làm tròn ở độ chính xác database.
- Chỉ làm tròn khi hiển thị/xuất: m 2 chữ số, km 3 chữ số, m² 2 chữ số, ha 4 chữ số, tỷ lệ 2 chữ số; cho phép cấu hình.
- Không dùng giá trị đã làm tròn để tính tổng tiếp theo.

## 8. Bộ mẫu kiểm chứng công thức

| Mã      | Đầu vào                         | Kết quả kỳ vọng       |
| ------- | ------------------------------- | --------------------- |
| CAL-001 | Tuyến chuẩn 1.000 m, hệ số 2    | 2.000 m               |
| CAL-002 | Polygon chuẩn 10.000 m²         | 1 ha                  |
| CAL-003 | 2.000 m² × 2 lần/ngày × 30 ngày | 120.000 m².lần        |
| CAL-004 | 10 km × hệ số 2 × 5 lượt        | 100 xe.km             |
| CAL-005 | 10 km × 3 tấn và 20 km × 7 tấn  | Bình quân 17 km       |
| CAL-006 | Nguồn 100, kiểm tra 90          | Chênh -10; -10%       |
| CAL-007 | Nguồn 0, kiểm tra 5             | Chênh 5; không tính % |
