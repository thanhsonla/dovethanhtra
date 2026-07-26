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

## Rà soát triển khai ngày 26/07/2026

- [x] Vercel trả HTML `200`, reverse proxy cùng nguồn hoạt động và phiên hiện có mở
  được bản đồ không có lỗi console.
- [x] `/api/v1/health/live` trả `200`; session warm đo được khoảng 125 ms.
- [ ] `/api/v1/health/ready` đang trả `503` vì object storage chưa kết nối.
- [ ] Render API đang dùng gói Free và các lượt keep-alive cho thấy cold start
  46–57 giây; chưa đáp ứng yêu cầu ổn định production.
- [ ] Credential database/bootstrap từng xuất hiện trong repository phải được đổi,
  thu hồi và quét lại toàn lịch sử trước deploy.
- [~] Mã sửa warm-up/retry/fail-closed đã có local nhưng chưa được đẩy và deploy.
- [~] E2E Chromium đi qua đăng nhập nhưng timeout tại `Ghi vị trí GPS` trong ngăn
  Nâng cao; chưa thể coi toàn bộ regression đạt.

Kế hoạch khắc phục chi tiết, không xét nội dung địa giới, nằm tại
`docs/15_STABILITY_REMEDIATION_PLAN.md`.

## Còn chặn trước production

- [ ] Field test trên thiết bị thực theo `docs/12_FIELD_TEST_PROTOCOL.md`.
- [ ] Restore staging và xác nhận ranh giới 75 xã/phường từ nguồn có thẩm quyền.
- [ ] Bằng chứng provider tile/route và quota trong môi trường triển khai thật.
- [ ] Bổ sung E2E hồi quy GPS, route, ảnh, import, đối chiếu và export/version.
- [ ] Chạy secret scan bằng Gitleaks trong CI và lưu kết quả release.
- [ ] Dùng instance API không tự ngủ và đo 20 lượt đăng nhập p95 dưới 1 giây.
- [ ] Cấu hình object storage để readiness trả `200`.

## Rollback

1. Tắt feature flag map-first (nếu được bật ở môi trường triển khai) và giữ API cũ.
2. Dừng worker export, bảo toàn bucket artifact và snapshot gần nhất.
3. Khôi phục database/bucket từ manifest backup đã xác minh.
4. Chạy healthcheck, kiểm tra audit/hash và chỉ mở lại traffic sau khi đạt.

Không rollback bằng cách xóa migration hoặc xóa measurement; dữ liệu mới phải được
giữ lại để đối soát và phục hồi có kiểm soát.
