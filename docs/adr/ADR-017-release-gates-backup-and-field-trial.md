# ADR-017 — Cổng phát hành, backup/restore và nghiệm thu thực địa

- Trạng thái: Chấp nhận
- Ngày: 19/07/2026
- Phạm vi: Mốc 6

## Quyết định

- Cổng phát hành bắt buộc gồm format, lint, type-check, unit, integration,
  Chromium/WebKit E2E, migration up/down, dependency/secret scan và bundle budget.
- Benchmark riêng tạo 10.000 geometry, yêu cầu đọc dataset dưới 5 giây và tạo XLSX
  dưới 30 giây trên CI/local chuẩn. Benchmark không chạy lẫn unit suite.
- API đặt security header, `no-store` và giới hạn đăng nhập theo IP. HSTS chỉ bật
  khi `COOKIE_SECURE=true`; reverse proxy production vẫn phải cưỡng chế HTTPS.
- Backup local/staging gồm PostgreSQL custom dump, toàn bộ object của bucket và
  SHA-256 manifest. Restore drill luôn dùng database/bucket tạm, không ghi đè dữ
  liệu đang chạy; đề xuất ban đầu RPO 24 giờ, RTO 8 giờ.
- Field test phải ghi thiết bị, thời tiết, route/GPS tham chiếu, accuracy, sai khác
  và quyết định cấu hình. Không đánh dấu đạt nếu chưa chạy trên thiết bị mục tiêu.

## Hệ quả

- CI phát hiện sớm hồi quy bảo mật, hiệu năng và khả năng phục hồi.
- Restore drill local chứng minh quy trình kỹ thuật nhưng không thay thế staging có
  dữ liệu/khối lượng gần production.
- Mốc 6 có thể hoàn tất phần kỹ thuật trong repository; phát hành production vẫn bị
  chặn bởi field test, staging restore, nguồn địa giới và key nhà cung cấp chính thức.
