# ADR-012: Hình học và phiên bản phép đo Mốc 2

- Trạng thái: Accepted
- Ngày: 18/07/2026

## Bối cảnh

Phép đo cần giữ bằng chứng gốc, tính chính thức bằng PostGIS và cho phép hiệu chỉnh
sau xác nhận mà không làm mất lịch sử. Bản đồ cũng phải thay nền mà không làm mất
lớp dữ liệu nghiệp vụ hoặc phụ thuộc khóa API trong môi trường local/test.

## Quyết định

- Lưu `raw_geometry` đúng GeoJSON nhận được. Chỉ tạo `normalized_geometry` riêng khi
  hình học hợp lệ và đúng kiểu; không dùng `ST_MakeValid` để âm thầm thay bằng chứng.
- Chiều dài và diện tích chính thức dùng `ST_Length(...::geography)` và
  `ST_Area(...::geography)`. Kết quả lưu cùng mã/phiên bản quy tắc, đầu vào và đầu ra.
- Hình học lỗi vẫn được lưu ở trạng thái `needs_attention`, nhưng không được xác
  nhận. Ngoài ranh giới và chồng lặp là warning có số liệu, không tự cắt/trừ.
- Phép đo đã xác nhận là bất biến về nghiệp vụ. Hiệu chỉnh tạo bản ghi có `version`
  tăng và `supersedes_id`; bản cũ chuyển `superseded`, bản mới phải xác nhận lại.
- MapLibre chỉ biết `BasemapProvider`. Mốc 2 cung cấp hai nền kỹ thuật local không
  gọi tile ngoài; provider thật có thể bổ sung sau khi có nguồn và điều khoản sử dụng.
- Client chỉ tính tạm để phản hồi khi vẽ. Giá trị trả từ API là kết quả chính thức.

## Hệ quả

Lịch sử hình học và công thức có thể truy vết, đổi nền không ảnh hưởng nguồn/lớp
GeoJSON. Database lưu thêm raw và normalized geometry nên tốn dung lượng hơn. Fixture
ranh giới Mốc 1 chỉ dùng kiểm thử kỹ thuật; vẫn cần ranh giới chính thức trước field test.
