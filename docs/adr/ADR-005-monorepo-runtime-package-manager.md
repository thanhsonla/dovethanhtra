# ADR-005: Monorepo, runtime và package manager

- Trạng thái: Accepted
- Ngày: 18/07/2026

## Bối cảnh

MVP có PWA, API và mã hợp đồng dùng chung. Dự án cần một lệnh local và một lockfile,
nhưng quy mô Mốc 0 chưa cần hệ thống build phân tán.

## Quyết định

Dùng pnpm workspace với `apps/web`, `apps/api` và `packages/*`. Pin Node.js 24.18.0
LTS, pnpm 11.9.0 và TypeScript 6.0.3. Dùng ESM và TypeScript strict. Chưa dùng Nx
hoặc Turborepo. TypeScript 7 chưa được chọn vì typescript-eslint chưa công bố hỗ trợ.

Ghi phiên bản Node/pnpm trong `mise.toml`, đồng thời giữ `.node-version` và trường
`packageManager` để các công cụ không dùng mise vẫn đọc được. `pnpm doctor` là cổng
kiểm tra local/CI; `pnpm doctor:services` kiểm tra thêm PostGIS và MinIO local.

## Hệ quả

Một lockfile và script gốc giữ CI/local đồng nhất. Khi số package hoặc thời gian CI
tăng rõ rệt, có thể đánh giá thêm cache task mà không đổi ranh giới ứng dụng.
Mise chỉ là công cụ kích hoạt runtime, không trở thành dependency chạy production.
