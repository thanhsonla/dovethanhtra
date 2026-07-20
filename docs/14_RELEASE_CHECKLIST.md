# Checklist nghiệm thu và rollout

Tài liệu này là cổng phát hành Task 10. Các mục chỉ được đánh dấu đạt khi có bằng
chứng lưu trong CI hoặc biên bản chạy thử; fixture local không thay thế field test.

## Đã kiểm tra local

- [x] `pnpm doctor`, health dịch vụ local và Node.js 24.18.0.
- [x] Format, lint, typecheck, unit test, build và bundle budget.
- [x] Integration API với PostgreSQL/PostGIS (24 test).
- [x] Performance 5.000 geometry và export 10.000 dòng.
- [x] Backup/restore local với manifest SHA-256.
- [x] `pnpm audit --audit-level high`.
- [~] E2E luồng hồ sơ/cấu trúc đạt; bộ lọc đã đổi sang selector ổn định và cần chạy
  lại đầy đủ Chromium/WebKit trước khi đóng cổng.

## Còn chặn trước production

- [ ] Field test trên thiết bị thực theo `docs/12_FIELD_TEST_PROTOCOL.md`.
- [ ] Restore staging và xác nhận ranh giới 75 xã/phường từ nguồn có thẩm quyền.
- [ ] Bằng chứng provider tile/route và quota trong môi trường triển khai thật.
- [ ] Bổ sung E2E hồi quy GPS, route, ảnh, import, đối chiếu và export/version.
- [ ] Chạy secret scan bằng Gitleaks trong CI và lưu kết quả release.

## Rollback

1. Tắt feature flag map-first (nếu được bật ở môi trường triển khai) và giữ API cũ.
2. Dừng worker export, bảo toàn bucket artifact và snapshot gần nhất.
3. Khôi phục database/bucket từ manifest backup đã xác minh.
4. Chạy healthcheck, kiểm tra audit/hash và chỉ mở lại traffic sau khi đạt.

Không rollback bằng cách xóa migration hoặc xóa measurement; dữ liệu mới phải được
giữ lại để đối soát và phục hồi có kiểm soát.
