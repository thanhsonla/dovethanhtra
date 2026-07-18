# ADR-010: Baseline kiểm thử và CI

- Trạng thái: Accepted
- Ngày: 18/07/2026

## Bối cảnh

Rủi ro chính của dự án nằm ở tính đúng, migration, trình duyệt hiện trường và secret.

## Quyết định

Dùng Vitest cho unit/integration và Playwright cho Chromium cùng WebKit/iPad. GitHub
Actions chạy format, lint, typecheck, test, build, audit dependency, secret scan,
migration `up/down/up` trên PostGIS thật và E2E smoke.

## Hệ quả

CI tải browser binary và chạy service container nên chậm hơn test đơn thuần. Đổi lại,
baseline phát hiện sớm lỗi môi trường và rollback trước khi có dữ liệu nghiệp vụ.
