# 11. Runbook vận hành và phục hồi

## 1. Cổng trước phát hành

Chạy bằng Node 24.18.0 và pnpm 11.9.0:

```bash
pnpm doctor:services
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm exec dotenv -e .env.example -- pnpm test:integration
pnpm exec dotenv -e .env.example -- pnpm test:performance
pnpm build
pnpm bundle:check
pnpm exec dotenv -e .env.example -- pnpm test:e2e
pnpm audit --audit-level high
```

Production còn yêu cầu HTTPS, `COOKIE_SECURE=true`, secret manager, CSP tại reverse
proxy/static host, key provider giới hạn domain/API/quota và cảnh báo dung lượng.

## 2. Backup

Đề xuất ban đầu: backup hằng ngày, RPO 24 giờ, RTO 8 giờ. Đường dẫn đích phải tuyệt
đối và chưa tồn tại:

```bash
pnpm exec dotenv -e .env.example -- pnpm backup:local /absolute/backup/dove-YYYYMMDD
```

Gói gồm `database.dump`, thư mục `objects`, `MANIFEST` và `SHA256SUMS`. Sao chép gói
ra vùng lưu trữ tách biệt, mã hóa và áp dụng retention theo chính sách cơ quan.

## 3. Restore drill an toàn

```bash
pnpm exec dotenv -e .env.example -- pnpm restore:verify:local /absolute/backup/dove-YYYYMMDD
```

Lệnh kiểm hash, phục hồi vào database/bucket tạm, kiểm PostGIS và số bản ghi rồi tự
dọn tài nguyên tạm. Nó không ghi đè database/bucket đang chạy. Trước production,
chạy cùng quy trình trên staging và ghi thời gian thực tế vào checklist.

## 4. Theo dõi và xử lý sự cố

- Theo dõi `/api/v1/health/live` và `/api/v1/health/ready`.
- Khi database/object storage chưa sẵn sàng, dừng mutation và giữ queue local.
- Không đưa token, tọa độ chi tiết hoặc URL ký vào ticket/log.
- Khi nghi mất toàn vẹn, khóa hồ sơ liên quan, giữ snapshot/export/hash và sao lưu
  trước khi sửa.
- Rollback migration có dữ liệu chứng cứ có thể bị từ chối có chủ đích; không ép
  xóa bảng để vượt guard.

## 5. Checklist production

- [ ] Field test có người xác nhận và sai khác trong ngưỡng đã chốt.
- [ ] Restore staging thành công, ghi RPO/RTO thực tế.
- [ ] Ranh giới và cơ sở xử lý là dữ liệu chính thức, không phải fixture.
- [ ] HTTPS, secure cookie, CSP/CORS và upload policy được xác minh.
- [ ] Mapbox/basemap key đã giới hạn và có quota/cảnh báo.
- [ ] Không có Critical/High từ dependency và secret scan.
- [ ] Backup scheduler, retention và người nhận cảnh báo đã được phân công.
