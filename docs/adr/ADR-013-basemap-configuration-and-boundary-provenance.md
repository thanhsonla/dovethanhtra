# ADR-013: Cấu hình basemap và nguồn gốc ranh giới

- Trạng thái: Accepted
- Ngày: 19/07/2026

## Bối cảnh

Nền kỹ thuật local giúp phát triển không cần token nhưng không đủ ngữ cảnh cho chạy
thực địa. Ranh giới seed cũng chỉ là fixture. Việc bổ sung nguồn thật phải tránh
nhúng secret, thiếu attribution hoặc thay dữ liệu cùng phiên bản mà không để lại dấu.

## Quyết định

- Basemap bên ngoài chỉ được bật khi có đồng thời style URL hợp lệ và attribution.
  Chỉ chấp nhận HTTPS, ngoại trừ HTTP trên localhost; URL có user/password bị từ chối.
- Public browser token, nếu nhà cung cấp yêu cầu, được truyền qua biến môi trường và
  phải giới hạn domain/API/quota. Không ghi token thật vào repository hoặc log.
- Nếu style cấu hình không tải được trước khi hoàn tất, giao diện chuyển về nền kỹ
  thuật local và thông báo rõ; lớp phép đo không phụ thuộc vòng đời của style nền.
- Ranh giới chính thức được nhập bằng GeoJSON `FeatureCollection` EPSG:4326. Mỗi
  feature bắt buộc có code, tên, loại, nguồn, phiên bản và thời gian hiệu lực.
- Hệ thống hash SHA-256 đúng byte nguồn, kiểm tra cấu trúc trước khi gọi PostGIS và
  kiểm tra `ST_IsValid` trước khi lưu. Không dùng `ST_MakeValid` hoặc tự đoán CRS.
- Cùng `code/sourceVersion` và cùng hash là import lặp an toàn. Nếu hash khác, từ
  chối ghi đè và yêu cầu một `sourceVersion` mới. Hồ sơ tiếp tục giữ boundary snapshot.

## Hệ quả

Có thể cấu hình nhà cung cấp được cấp phép mà không sửa component bản đồ, đồng thời
vẫn chạy local khi chưa có nguồn thật. Việc thay ranh giới trở nên truy vết được nhưng
người vận hành phải chuẩn bị metadata/version đúng và sửa hình học tại nguồn nếu lỗi.
`source_hash` có thể null cho bản ghi legacy; mọi import qua CLI mới luôn có hash.
