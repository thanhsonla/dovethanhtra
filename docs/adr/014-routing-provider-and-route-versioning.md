# ADR-014 — RoutingProvider backend và phiên bản route bất biến

- Trạng thái: Chấp nhận
- Ngày: 19/07/2026
- Phạm vi: Mốc 3

## Bối cảnh

Route là kết quả từ nhà cung cấp bên ngoài nhưng đồng thời là bằng chứng đầu vào cho
công thức xe.km và tấn.km. Token không được lộ ở trình duyệt, lỗi quota/timeout phải
được chuẩn hóa và một lần tính lại không được làm mất route đã dùng trước đó.

## Quyết định

- Web chỉ gọi API ứng dụng. API gọi `RoutingProvider` và chọn adapter bằng cấu hình.
- Mapbox Directions v5 là adapter production đầu tiên. Local/test mặc định dùng
  provider xác định, không truy cập mạng và luôn mang nhãn nguồn `local-deterministic`.
- Mỗi lần lưu, API tự gọi provider lại và lưu geometry, legs, distance, duration,
  profile, thời điểm, request không có token và SHA-256 fingerprint. Không tin kết
  quả distance/geometry gửi ngược từ trình duyệt.
- Route được mở rộng từ một `measurement` đã xác nhận. Tính lại tạo measurement và
  transport_route mới; measurement cũ chuyển `superseded` trong cùng transaction.
- Giới hạn chung là 25 tọa độ (đầu, cuối và tối đa 23 waypoint). Timeout, 429,
  không tìm thấy đường và lỗi provider được ánh xạ thành mã lỗi miền ổn định.
- Công thức lưu snapshot/version của công tác. Cự ly bình quân gia quyền trả cảnh
  báo `MISSING_TRANSPORT_WEIGHT` khi tổng khối lượng bằng 0.

## Hệ quả

- Lịch sử route và nguồn cự ly có thể truy vết; token chỉ ở backend.
- Lưu route tốn thêm một lượt provider sau bước xem trước, đổi lại máy chủ không
  phải tin payload do client sửa. Chênh lệch giữa preview và lần lưu được trả bằng
  chính bản route đã lưu.
- Provider local chỉ là fixture kỹ thuật, không thay thế route thực tế. Trước
  production phải cấu hình token giới hạn API/quota và đối chứng tuyến hiện trường.
