# 10. Hướng dẫn sử dụng MVP

## 1. Chuẩn bị

1. Đăng nhập bằng tài khoản được cấp; không dùng tài khoản mẫu ngoài local.
2. Kiểm tra đúng địa bàn, thời kỳ và đơn vị được kiểm tra trước khi tạo hồ sơ.
3. Trên thiết bị hiện trường, cấp quyền vị trí/ảnh và xác nhận trạng thái trực tuyến.

## 2. Luồng hồ sơ end-to-end

1. Tạo hồ sơ, chọn phiên bản địa giới và thêm công tác từ danh mục.
2. Chọn một công tác trong thẻ **Công tác đang đo**. Ứng dụng tự xác định hành động
   Ghi điểm/Thêm đoạn/Thêm vùng/Mở lộ trình từ danh mục và ghi nhớ lựa chọn trong
   phiên làm việc. Nếu chưa có công tác, dùng **Tạo công tác nhanh** ngay trên bản đồ.
3. Xem kết quả tạm trên trình duyệt; chỉ kết quả máy chủ và phép đo `confirmed`
   được cộng vào tổng chính thức.
4. Nếu sửa phép đo đã xác nhận, dùng hiệu chỉnh để tạo phiên bản mới. Không xóa dữ
   liệu cũ để “làm lại”.
5. Nhập từng khối lượng nguồn, ngưỡng và giải trình; cảnh báo không phải kết luận
   sai phạm.
6. Kiểm tra ảnh đã ở trạng thái hoàn tất, đối chiếu tổng và audit.
7. Nhập lý do rồi khóa hồ sơ. Sau khóa không thể sửa hoặc hoàn tất upload đang chờ.
8. Xuất Excel/GeoJSON từ hồ sơ đã khóa và lưu hash/tệp cùng hồ sơ nghiệp vụ.

## 3. Import, phục hồi và xuất tệp

- Trong bản đồ, chọn công tác điểm/tuyến/vùng rồi mở **Import GeoJSON**. Chọn tệp,
  kiểm số feature/schema/hash ở preview và chỉ bấm **Import chính thức** khi đúng.
- **Kỹ thuật sáng/tối · kiểm thử** trong danh sách bản đồ nền chỉ là nền màu local
  để kiểm thử hoặc dùng khi các nền ảnh lỗi. Nền này vẫn vẽ/đo được nhưng không có
  ảnh vệ tinh, tên đường hoặc địa danh để định vị ngoài thực địa.
- Nút **Chi tiết** mở/đóng ngăn thuộc tính. Ngăn tự mở sau khi kết thúc phép đo để
  nhập tên và lưu, nhưng có thể đóng khi cần quan sát toàn bộ bản đồ.
- Phiếu lưu tự đặt tên Điểm/Đoạn/Vùng theo số thứ tự. Các đầu vào công thức hợp lệ
  được kế thừa từ phép đo cập nhật gần nhất và luôn có thể sửa trước khi lưu.
- **Lưu và tiếp tục** tạo phép đo nháp rồi lập tức giữ nguyên công tác để đo bộ phận
  tiếp theo. **Lưu và xác nhận** yêu cầu máy chủ tính, kiểm tra và xác nhận trong một
  thao tác; nếu có bất kỳ cảnh báo nào, ứng dụng chỉ lưu nháp và yêu cầu rà soát.

Khi cùng công tác còn phép đo chưa đưa vào tổng, nút **Cần rà soát** xuất hiện ngay
trên bản đồ. Mở danh sách để xem từng bộ phận: nháp không có cảnh báo có thể **Xác
nhận** một chạm; mục có cảnh báo chỉ có nút **Xem** để kiểm tra chi tiết trước. Ứng
dụng không tự xác nhận hoặc cộng mục có cảnh báo.

**Tiến độ hồ sơ** cho biết có bao nhiêu công tác đã có dữ liệu, số bộ phận đã xác
nhận và số mục cần xử lý. Nút **Đến việc cần làm** chuyển trực tiếp đến công tác còn
nháp/cảnh báo trước, sau đó đến công tác chưa đo; đây là chỉ dẫn thao tác, không phải
đánh giá hoàn thành nghiệp vụ.
- Khi vẽ **Tuyến** hoặc **Vùng**, nhãn nhỏ dưới thanh công cụ cập nhật trực tiếp tổng
  chiều dài hoặc diện tích tạm tính sau mỗi điểm. Giá trị chính thức xuất hiện sau
  khi lưu và máy chủ kiểm tra hình học.
- Mỗi điểm bấm trên bản đồ được đánh dấu bằng vòng tròn, điểm mới nhất có chữ thập
  đỏ để xác nhận đúng tọa độ vừa chọn. Dùng **Lùi điểm** để bỏ điểm vừa bấm nhầm và
  **Khôi phục điểm** để đưa điểm đó trở lại.
- Các ô như **Hệ số mặt/tuyến**, **Tần suất thực hiện** và **Số ngày thực hiện** là
  đầu vào công thức của công tác. Ví dụ hệ số mặt/tuyến thường là 1 cho một mặt và
  2 cho hai mặt nếu hợp đồng quy định; các giá trị này được lưu cùng phép đo để máy
  chủ tính khối lượng chính thức.
- Trong cây lớp dữ liệu, mỗi công tác hiển thị tổng đã xác nhận và số bộ phận được
  cộng tổng. Bên dưới là từng đoạn/vùng/điểm riêng với giá trị cơ sở, khối lượng và
  trạng thái để biết phần nào đã được tính, phần nào còn nháp hoặc cần xử lý.
- Tệp tối đa 5 MB và 1.000 feature, chỉ EPSG:4326. Nếu sửa tệp sau preview phải
  preview lại; hệ thống không commit một phần batch lỗi.
- Mở **Phép đo đã xóa**, **Hồ sơ đã xóa** hoặc danh sách ảnh đã xóa, nhập lý do rồi
  phục hồi. Hệ thống không tự phục hồi dây chuyền bản ghi con.
- Khi API báo conflict/locked, ghi lại mã lỗi và trace ID, bấm **Nạp lại dữ liệu**
  rồi kiểm tra trạng thái mới trước khi thử lại.
- Export chạy nền. Chờ trạng thái `completed` để tải; `failed` giữ mã lỗi cho vận
  hành. Tệp tải luôn đi qua API kiểm quyền, không chia sẻ object key MinIO.

## 4. Làm việc ngoại tuyến

- Giữ trang đang mở trước khi mất mạng; PWA không cam kết có bản đồ nền ngoại tuyến.
- GPS draft và mutation queue được giữ trong IndexedDB. Không xóa dữ liệu trình
  duyệt trước khi trạng thái chuyển thành `synced`.
- `conflict` do hồ sơ đã khóa phải được xử lý bằng mở khóa có lý do hoặc giữ bản
  nháp để đối chứng; không gửi lại bằng khóa idempotency khác để né xung đột.

## 5. Xử lý cảnh báo

- `GEOMETRY_INVALID`: sửa hình học; hệ thống không tự thay bản gốc.
- `OUTSIDE_CASE_BOUNDARY`/`OVERLAP_DETECTED`: kiểm tra bản đồ và ghi chú lý do.
- GPS accuracy cao: giữ raw track, đo lại nếu điều kiện cho phép.
- Route không tìm được: kiểm tra điểm đầu/cuối/waypoint và provider; không nhập cự
  ly ước đoán thành kết quả định tuyến.
- Upload pending/failed: thử lại khi mạng ổn định; chỉ attachment `completed` là
  bằng chứng hợp lệ. Ảnh mới phải có `scanStatus=clean`; ảnh
  `not_scanned_legacy` cần vận hành quét lại trước khi dùng ngoài local/test.
