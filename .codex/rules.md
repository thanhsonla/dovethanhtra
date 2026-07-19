# Quy tắc làm việc bổ sung cho Codex

- Luôn tuân thủ `AGENTS.md` tại thư mục gốc.
- Đọc `README.md`, PRD, tài liệu chuyên đề, kế hoạch kiểm thử và kế hoạch triển khai trước khi sửa mã.
- Chỉ làm đúng mốc được giao; không triển khai trước chức năng của mốc sau.
- Máy chủ là nguồn kết quả chính thức; dữ liệu không gian lưu EPSG:4326 theo thứ tự `[longitude, latitude]`.
- Mọi tích hợp bản đồ, định tuyến và object storage phải qua adapter.
- `mt1.google.com` được phép dùng riêng cho raster basemap theo ADR-022, bắt buộc qua
  `BasemapProvider`, không cache ngoại tuyến và không dùng để trích xuất dữ liệu.
- Không commit secret thật, `.env`, token, URL có chữ ký hoặc dữ liệu nhạy cảm.
- Thay đổi phải có lint, typecheck và kiểm thử tương ứng; migration phải kiểm tra tiến và lùi.
- Không xóa cứng dữ liệu nghiệp vụ và không làm mất bằng chứng hoặc lịch sử.
