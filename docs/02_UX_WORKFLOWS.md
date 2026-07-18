# 02. Thiết kế màn hình và quy trình thao tác

## 1. Nguyên tắc giao diện

- Bản đồ là vùng làm việc trung tâm; danh mục và thuộc tính không che quá nhiều bản đồ.
- Mỗi thời điểm chỉ có một chế độ thao tác: xem, chọn, vẽ điểm, vẽ tuyến, vẽ vùng, định tuyến hoặc GPS.
- Luôn hiển thị công tác đang được ghi dữ liệu để tránh lưu nhầm.
- Kết quả tạm thời và kết quả máy chủ phải có nhãn khác nhau.
- Thao tác nguy cơ mất dữ liệu phải có xác nhận và khả năng khôi phục.
- Màu dùng theo nhóm dịch vụ nhưng trạng thái lỗi/cảnh báo ưu tiên màu hệ thống.

## 2. Điều hướng chính

| STT | Phân hệ            |
| --: | ------------------ |
|   1 | Tổng quan          |
|   2 | Hồ sơ kiểm tra     |
|   3 | Bản đồ hiện trường |
|   4 | Danh mục công tác  |
|   5 | Cơ sở xử lý rác    |
|   6 | Nhập/xuất dữ liệu  |
|   7 | Nhật ký            |
|   8 | Cài đặt            |

## 3. Màn hình máy tính

### 3.1. Danh sách hồ sơ

Hiển thị mã hồ sơ, địa bàn, thời kỳ, đơn vị, trạng thái, số công tác, tiến độ dữ liệu và lần sửa gần nhất. Bộ lọc được ghi nhớ theo người dùng.

Thao tác: tạo mới, mở, sao chép cấu trúc, lưu trữ, xuất nhanh.

### 3.2. Không gian kiểm tra

Giao diện ba vùng:

- **Trái:** cây nhóm dịch vụ → công tác → các phép đo.
- **Giữa:** bản đồ, thanh công cụ đo, chọn bản đồ nền, lớp dữ liệu và tìm vị trí.
- **Phải:** thuộc tính đối tượng, kết quả, nguồn số liệu, ảnh và cảnh báo.

Thanh trạng thái phía dưới hiển thị tọa độ, mức zoom, độ chính xác GPS, số đối tượng đang chọn và trạng thái đồng bộ.

### 3.3. Bảng đối chiếu

Cột chính: nhóm dịch vụ, công tác, đơn vị tính, dự toán, hợp đồng, nghiệm thu, kiểm tra, chênh lệch, tỷ lệ, cảnh báo, giải trình.

Nhấn vào một dòng sẽ lọc bản đồ theo công tác tương ứng.

## 4. Màn hình iPad/điện thoại

- Toàn màn hình ưu tiên bản đồ.
- Nút “Công tác đang đo” đặt trên cùng.
- Thanh công cụ dưới: vị trí, điểm, tuyến, vùng, route, ảnh, lưu.
- Danh sách và thuộc tính mở bằng bottom sheet.
- Nút tối thiểu khoảng 44 x 44 px; trạng thái GPS và ngoại tuyến luôn nhìn thấy.
- Trước khi lưu, hiển thị tóm tắt: loại phép đo, kết quả, sai số, số ảnh và cảnh báo.

## 5. Quy trình nghiệp vụ chính

### FLOW-01 — Tạo hồ sơ

1. Chọn “Tạo hồ sơ”.
2. Nhập tên, mã, địa bàn, phiên bản ranh giới và thời kỳ.
3. Chọn đơn vị được kiểm tra và cơ sở xử lý liên quan.
4. Chọn công tác từ danh mục hoặc sao chép cấu trúc hồ sơ mẫu.
5. Kiểm tra tóm tắt và tạo hồ sơ ở trạng thái nháp.

### FLOW-02 — Thêm công tác mới

1. Chọn nhóm dịch vụ.
2. Chọn loại công tác có sẵn hoặc “Tạo loại công tác”.
3. Xác nhận đơn vị, kiểu đo và công thức.
4. Nhập tên cụ thể, kỳ thực hiện và ngưỡng cảnh báo.
5. Lưu công tác vào hồ sơ.

### FLOW-03 — Đo tuyến/diện tích

1. Chọn công tác.
2. Chọn chế độ “Tuyến” hoặc “Vùng”.
3. Vẽ, hoàn tác hoặc chỉnh đỉnh.
4. Ứng dụng hiển thị kết quả tạm.
5. Nhập tên tuyến/vị trí, tần suất, kỳ áp dụng và ghi chú.
6. Chụp/gắn ảnh nếu cần.
7. Lưu; máy chủ kiểm tra và tính lại.
8. Xử lý cảnh báo hoặc xác nhận phép đo.

### FLOW-04 — Ghi GPS hiện trường

1. Chọn công tác và “Bắt đầu GPS”.
2. Ứng dụng kiểm tra quyền vị trí, pin và độ chính xác ban đầu.
3. Ghi hành trình; hiển thị quãng đường tạm, thời gian và sai số.
4. Có thể tạm dừng ở thời điểm dừng kiểm tra.
5. Kết thúc, xem lại tuyến và các đoạn sai số cao.
6. Lưu nháp ngoại tuyến hoặc gửi máy chủ.
7. Không tự xóa điểm sai; nếu lọc nhiễu phải lưu cả bản gốc và quy tắc lọc.

### FLOW-05 — Tính cự ly vận chuyển

1. Chọn công tác vận chuyển và “Tạo lộ trình”.
2. Chọn điểm xuất phát, trạm trung chuyển, cơ sở xử lý.
3. Thêm điểm bắt buộc nếu cần.
4. Chọn cấu hình xe và kiểu route.
5. Xem các phương án; chọn một phương án.
6. Nhập số lượt, khối lượng, hệ số chiều về.
7. Lưu route cùng provider, thời gian và geometry.
8. Nếu tính lại, tạo phiên bản mới và cho phép so sánh.

### FLOW-06 — Đối chiếu và khóa hồ sơ

1. Nhập khối lượng dự toán/hợp đồng/nghiệm thu.
2. Chọn “Tính đối chiếu”.
3. Xử lý cảnh báo thiếu dữ liệu, trùng geometry và chênh lệch.
4. Ghi giải trình và gắn tài liệu.
5. Chuyển trạng thái soát xét.
6. Xuất bản nháp, kiểm tra số liệu.
7. Khóa hồ sơ; hệ thống tạo snapshot kết quả và nhật ký.

## 6. Trạng thái và thông báo

- **Nháp:** chưa đưa vào tổng chính thức.
- **Đã gửi:** đang chờ máy chủ tính/kiểm tra.
- **Cần xử lý:** có lỗi hoặc cảnh báo chưa xác nhận.
- **Đã xác nhận:** được dùng để tổng hợp.
- **Đã thay thế:** còn trong lịch sử nhưng không cộng tổng.
- **Đã xóa mềm:** không hiển thị mặc định, có thể phục hồi.

Thông báo phải nói rõ hành động, đối tượng và cách xử lý; tránh dùng thông báo chung như “Có lỗi xảy ra”.

## 7. Khả năng truy cập và thao tác ngoài hiện trường

- Độ tương phản tối thiểu đáp ứng WCAG AA cho chữ và điều khiển chính.
- Không dùng màu làm tín hiệu duy nhất; kèm biểu tượng/nhãn.
- Hỗ trợ tăng cỡ chữ mà không che nút lưu.
- Cảnh báo GPS yếu bằng chữ và rung nếu thiết bị hỗ trợ.
- Khi pin thấp, nhắc lưu nháp và giảm tần suất GPS nếu người dùng đồng ý.
