# ADR-010: Baseline kiểm thử và CI

- Trạng thái: Accepted
- Ngày: 18/07/2026

## Bối cảnh

Rủi ro chính của dự án nằm ở tính đúng, migration, trình duyệt hiện trường và secret.

## Quyết định

Dùng Vitest cho unit/integration và Playwright cho Chromium cùng WebKit/iPad. GitHub
Actions chạy format, lint, typecheck, test, build, audit dependency, secret scan,
migration `up/down/up` trên PostGIS thật và E2E smoke.

CI kiểm tra thêm ngân sách bundle sau build: JavaScript khởi động tối đa 250 kB raw/
75 kB gzip, mô-đun bản đồ lazy-load tối đa 1.100 kB raw/300 kB gzip và CSS tối đa
100 kB raw/20 kB gzip. Mô-đun MapLibre không được tải trước khi người dùng mở bản đồ.

## Hệ quả

CI tải browser binary và chạy service container nên chậm hơn test đơn thuần. Đổi lại,
baseline phát hiện sớm lỗi môi trường và rollback trước khi có dữ liệu nghiệp vụ.
