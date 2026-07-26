# Kế hoạch khắc phục ổn định triển khai và đăng nhập

> Rà soát ngày 26/07/2026. Phạm vi tài liệu này không xem xét việc xác định hoặc
> nghiệm thu địa giới.

## 1. Kết luận hiện trạng

Web/PWA trên Vercel đang phục vụ ổn định ở lớp tĩnh và reverse proxy hoạt động.
Trong lần đo khi API đã thức:

- HTML Vercel trả `200` trong khoảng 140 ms.
- Trang vào DOM trong khoảng 517 ms; phiên đã đăng nhập mở được bản đồ, không có lỗi
  console.
- `/api/v1/auth/session` trả `200` khoảng 125 ms.
- Các API khởi tạo thông thường trả trong khoảng 100–276 ms; một số truy vấn dữ liệu
  bản đồ mất khoảng 1,9–2,5 giây.
- `/api/v1/health/live` trả `200`, nhưng `/api/v1/health/ready` trả `503` vì
  `objectStorage=false`.

Nút thắt đăng nhập không nằm ở Vercel. API đang chạy Render Free, có thể ngủ sau
15 phút không có traffic và mất khoảng một phút để thức lại. Lịch GitHub Actions
keep-alive thực tế có khoảng trống nhiều giờ; nhiều lượt mất 46–57 giây, cho thấy
API đã ngủ trước khi job chạy. Cơ chế này không phải cam kết uptime.

Rà soát mã còn phát hiện:

- Frontend gọi `/api/v1/health`, trong khi API chỉ có `/health/live` và
  `/health/ready`; warm-up vì vậy nhận `404`.
- Workflow keep-alive gọi `/api/v1/auth/me`, là route không tồn tại, và không
  fail khi nhận `404`.
- Cấu hình production thiếu object storage nên upload/evidence/export chưa sẵn sàng.
- Thông tin kết nối production từng được ghi trực tiếp trong tệp theo dõi Git.
- Xác thực từng có fallback chấp nhận một mật khẩu cố định khi Argon2 lỗi.

## 2. Thay đổi đã thực hiện trong mã

- Warm-up chuyển sang `/api/v1/health/live`.
- GET/HEAD tự thử lại có giới hạn khi gặp `502/503/504`; mutation chỉ tự thử lại khi
  có `Idempotency-Key`. Login POST không bị gửi lặp ngoài ý muốn.
- Argon2 được nạp lúc khởi động, xác thực fail-closed và bỏ transaction thừa khi chỉ
  ghi một session.
- Workflow keep-alive dùng route liveness thật, `curl --fail`, timeout và retry.
- `render.yaml` dùng secret do Render quản lý, khai báo đầy đủ object storage và
  dùng `/api/v1/health/ready` làm health check.
- Xóa entrypoint Vercel serverless cũ chứa cấu hình database; script đồng bộ bắt
  buộc nhận `REMOTE_DATABASE_URL` từ môi trường.
- Bổ sung unit test cho retry/idempotency và lỗi fallback mật khẩu.

## 3. Kế hoạch ưu tiên

### P0 — bắt buộc trước lần deploy tiếp theo

1. Đổi ngay mật khẩu Supabase/database và mật khẩu bootstrap đã từng xuất hiện
   trong Git; cập nhật secret trên Render. Việc xóa chuỗi ở HEAD không thu hồi
   credential đã có trong lịch sử.
2. Tạo/cấu hình R2 hoặc S3-compatible bằng các biến `MINIO_*` trong Render, tạo
   bucket private và xác minh `/health/ready` trả `200`.
3. Chọn Render instance không ngủ cho API production. Render Free chỉ phù hợp
   thử nghiệm; keep-alive không thay thế SLA. Nếu chưa nâng gói, phải chấp nhận lần
   truy cập đầu có thể chậm khoảng một phút.
4. Đẩy thay đổi, deploy Render trước, chờ health check xanh rồi deploy Vercel.
5. Smoke test qua đúng origin Vercel: health, đăng nhập/đăng xuất, session cookie,
   CSRF, mở bản đồ, upload ảnh và tải một export.
6. Chạy secret scan trên toàn Git history và build artifact; thu hồi mọi credential
   đã lộ trước khi đánh dấu đạt.

### P1 — hoàn tất Task 10, không gồm địa giới

1. Chạy lại E2E Chromium và WebKit cho đăng nhập, đo/lưu/phân loại, GPS, route, ảnh,
   import, đối chiếu, export và supersede.
   Lần chạy Chromium ngày 26/07 đã đi qua đăng nhập và phần lớn luồng chính nhưng
   timeout tại thao tác `Ghi vị trí GPS` trong ngăn Nâng cao; console cũng ghi nhận
   truy vấn layer MapLibre trước khi layer tương ứng tồn tại.
2. Chạy integration với PostgreSQL/PostGIS và object storage test riêng; không dùng
   database production.
3. Restore staging PostgreSQL + object storage, đối chiếu manifest/hash/audit.
4. Field test thiết bị thật cho thao tác, GPS, camera và khả năng phục hồi mạng.
5. Xác nhận ClamAV/R2 fail-closed, lifecycle chỉ áp dụng export và không xóa ảnh gốc.

### P2 — quan sát và tối ưu

1. Uptime monitor độc lập cho `/health/live` và `/health/ready`; cảnh báo khi hai
   lần liên tiếp lỗi hoặc p95 vượt ngưỡng.
2. Theo dõi Vercel External Origins, Render latency, Supabase pool và tỷ lệ `5xx`.
3. Đo ít nhất 20 lượt đăng nhập sau deploy; mục tiêu p95 auth dưới 1 giây khi API
   luôn thức và p95 mở không gian làm việc dưới 3 giây với dữ liệu hiện tại.
4. Giảm chunk bản đồ đang khoảng 1,17 MB bằng code-splitting tiếp nếu thiết bị thật
   cho thấy thời gian tải/parse không đạt.
5. Đưa bundle trở lại ngân sách: map lazy-load hiện vượt khoảng 68,84 kB raw /
   10,06 kB gzip và CSS vượt khoảng 18,17 kB raw.

## 4. Tiêu chí đóng lỗi đăng nhập chậm

- `/health/live` và `/health/ready` cùng trả `200`.
- Không còn request tới `/api/v1/health` hoặc `/api/v1/auth/me`.
- API không chạy trên instance tự ngủ trong môi trường production.
- 20 lần đăng nhập liên tiếp không có `502/503/504`, không tạo session lặp và p95
  auth dưới 1 giây.
- Đăng nhập sai không được retry tự động và không bao giờ đi qua mật khẩu fallback.
- Secret scan không còn credential thật trong HEAD/build; mọi credential từng lộ
  đã được thu hồi.
