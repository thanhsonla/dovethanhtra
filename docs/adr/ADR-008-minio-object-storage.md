# ADR-008: MinIO cho object storage local

- Trạng thái: Accepted
- Ngày: 18/07/2026

## Bối cảnh

Bằng chứng và tệp xuất cần object storage S3-compatible, giữ tệp gốc và có thể thay
nhà cung cấp khi triển khai.

## Quyết định

Dùng MinIO bằng Docker Compose ở local, bucket bootstrap riêng và named volume.
Ứng dụng chỉ truy cập qua `ObjectStorageProvider`; domain không biết URL hoặc object
key thật. Mốc 0 chỉ kiểm tra bucket trong readiness.

## Hệ quả

Credential trong `.env.example` chỉ là giá trị local giả. Staging/production phải
dùng secret manager, TLS, versioning/retention và chính sách quyền riêng.
