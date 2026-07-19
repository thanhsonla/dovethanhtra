# 10. Hướng dẫn sử dụng MVP

## 1. Chuẩn bị

1. Đăng nhập bằng tài khoản được cấp; không dùng tài khoản mẫu ngoài local.
2. Kiểm tra đúng địa bàn, thời kỳ và đơn vị được kiểm tra trước khi tạo hồ sơ.
3. Trên thiết bị hiện trường, cấp quyền vị trí/ảnh và xác nhận trạng thái trực tuyến.

## 2. Luồng hồ sơ end-to-end

1. Tạo hồ sơ, chọn phiên bản địa giới và thêm công tác từ danh mục.
2. Chọn công tác trước khi vẽ, ghi GPS, tạo route hoặc gắn ảnh.
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
