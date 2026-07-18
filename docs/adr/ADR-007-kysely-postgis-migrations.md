# ADR-007: Kysely, PostGIS và migration SQL-first

- Trạng thái: Accepted
- Ngày: 18/07/2026

## Bối cảnh

PostGIS và các transaction truy vết cần SQL rõ ràng. ORM không được che khuất phép
tính không gian hoặc khiến mô-đun truy cập bảng của nhau tùy tiện.

## Quyết định

Dùng `pg` và Kysely làm typed query layer. Repository của từng mô-đun sở hữu truy vấn
của mô-đun đó. Dùng `node-pg-migrate` cho migration có thứ tự và up/down. SQL PostGIS
được viết tường minh và kết quả chính thức luôn tính ở máy chủ.

Migration Mốc 0 chỉ bật `pgcrypto` và `postgis`. `database/schema.sql` tiếp tục là tài
liệu tham chiếu; chuyển bảng nghiệp vụ thành migration là công việc Mốc 1 trở đi.
Image `postgis/postgis:17-3.5` chạy với platform `linux/amd64` ở local vì image này
chưa có manifest ARM64; Docker Desktop trên Apple Silicon thực hiện emulation.

## Hệ quả

Nhóm phát triển phải viết mapper cho geometry và kiểm thử integration với PostGIS
thật. PostGIS local trên Apple Silicon chậm hơn image native. Rollback extension chỉ
an toàn trên database local/test trống và dùng `CASCADE` vì image tạo sẵn các extension
phụ thuộc `postgis_topology`/`postgis_tiger_geocoder`; tuyệt đối không chạy rollback
này trước khi rollback toàn bộ bảng không gian của các mốc sau.
