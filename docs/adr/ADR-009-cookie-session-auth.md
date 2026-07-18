# ADR-009: Phiên xác thực phía máy chủ

- Trạng thái: Accepted
- Ngày: 18/07/2026

## Bối cảnh

MVP ưu tiên PWA cùng origin và một chủ hồ sơ, nhưng mô hình phải mở rộng RBAC. OpenAPI
khung đang khai báo Bearer JWT trong khi tài liệu bảo mật yêu cầu secure cookie/session.

## Quyết định

Dùng session ID ngẫu nhiên trong cookie `HttpOnly`, `Secure` ở production và
`SameSite=Lax`; máy chủ chỉ lưu hash session. Mật khẩu dùng Argon2id và mutation có
CSRF protection. Chuẩn bị vai trò `owner`, `editor`, `reviewer`, `viewer`,
`catalog_admin`.

Mốc 1 hiện thực quyết định này bằng bảng `app_user`/`app_session`, Argon2id, cookie
session chỉ lưu hash phía máy chủ và CSRF double-submit. OpenAPI đã đổi từ bearer JWT
sang cookie security scheme.

## Hệ quả

Client trình duyệt không phải lưu bearer token. Client ngoài trình duyệt sau này cần
cơ chế token riêng và ADR bổ sung.
