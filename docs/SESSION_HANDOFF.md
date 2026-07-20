# Bàn giao nhanh cho phiên làm việc tiếp theo

> Cập nhật: 21/07/2026  
> Nhánh: `codex/map-first-workflow`  
> Commit chức năng gần nhất: `cd48382 feat: label commune boundaries on map`

## 1. Trạng thái trong một phút

- Mốc 0–6 đã có đủ nền tảng kỹ thuật và chức năng MVP; hiện chưa được coi là
  production-ready vì Task 10 vẫn đang nghiệm thu.
- Chuyển đổi map-first Task 0–9 đã hoàn thành. Người dùng có thể đo trước, lưu nháp,
  rồi phân loại theo Khu vực → Lĩnh vực → Công tác → Mục con.
- Bản đồ đang dùng đúng 75 xã/phường Sơn La trong PostGIS: 67 xã và 8 phường. Bộ
  topology tham khảo đã loại chồng lấn trên 0,01 m² nhưng chưa thay thế hồ sơ địa
  giới pháp lý của cơ quan có thẩm quyền.
- 12 huyện/thành phố cũ chỉ là tên khu vực quản lý, không có lớp geometry riêng.
- Trang local: `http://localhost:5180/`; API: `http://127.0.0.1:3000/`.
- Tài khoản giả local lấy từ `.env.example`: `owner@example.local` /
  `local-demo-password`. Không dùng các giá trị này ở staging/production.

## 2. Những phần đã hoàn thành — không triển khai lại

### Nền tảng

- pnpm workspace, TypeScript strict, Node.js 24.18.0, pnpm 11.9.0.
- React/Vite PWA; Fastify API theo mô-đun; Kysely/pg; node-pg-migrate.
- PostgreSQL/PostGIS, MinIO, cookie session + CSRF, Vitest, Playwright và CI.
- Audit append-only, soft delete, version/ETag, backup/restore local có SHA-256.

### Nghiệp vụ và dữ liệu

- Hồ sơ, danh mục, công tác/mục con, phép đo điểm–tuyến–vùng, route, GPS, ảnh,
  ngoại tuyến, đối chiếu, khóa snapshot, Excel và GeoJSON.
- Kết quả chính thức tính bằng PostGIS phía máy chủ; chỉ measurement `confirmed`
  được cộng tổng. Sửa measurement đã xác nhận tạo phiên bản supersede.
- CRUD/đổi tên/lưu trữ/phục hồi cho Khu vực, Lĩnh vực, Công tác và Mục con; không
  cascade xóa chứng cứ.
- Lọc theo toàn bộ cây phân loại và bbox/cursor; chọn feature để zoom/highlight,
  mở lịch sử, tải GeoJSON hoặc chỉnh sửa theo quyền.

### UX map-first

- Bản đồ chiếm vùng chính; toolbar dọc trên desktop, ngang trên iPad/điện thoại;
  drawer/bottom sheet đóng hoàn toàn.
- Đo ngay bằng Điểm, Chiều dài hoặc Diện tích; có marker đỉnh, chữ thập đỏ, lùi,
  tiến, xóa đỉnh, kết thúc và kết quả tạm bán trong suốt.
- Nháp được lưu local-first trong IndexedDB, đồng bộ idempotent và phân loại sau.
- Các nền “Kỹ thuật sáng/tối · kiểm thử” đã bị ẩn khỏi danh sách người dùng.
- Basemap đi qua `BasemapProvider`; `mt1.google.com` chỉ dùng theo ADR-022, không
  cache. Nhãn vector được giữ thẳng; raster hybrid khóa hướng Bắc.
- Ranh giới 75 xã/phường là nét đứt đỏ, dày theo zoom. Tên xã dùng
  `ST_PointOnSurface`, viết hoa–đứng–đậm, luôn thẳng và tự đổi cỡ 9–17 px theo zoom.

## 3. Kết quả kiểm tra gần nhất

- Đạt: `pnpm format:check`.
- Đạt: `pnpm lint`.
- Đạt: `pnpm typecheck`.
- Đạt: 74 unit test (web 40, API 34).
- Đạt: integration mục địa giới/hồ sơ 2/2 trên `dove_field_test`.
- Đạt trực tiếp local: API trả 75 boundary và 75 `labelPoint` hợp lệ.
- Đạt trực quan: trình duyệt có đủ 75 nhãn; cỡ chữ tăng 11,8 → 12,6 px sau một mức
  zoom; nhãn không cản click và không xuất hiện như nút trợ năng.
- Chưa đạt toàn bộ E2E:
  - Chromium bị timeout ở `tests/e2e/milestone-one.spec.ts:174`: danh sách lọc tự
    làm mới khiến nút feature bị detach trong lúc click.
  - WebKit iPad còn hộp “Phân loại kết quả đo” tại dòng 126 sau thao tác đóng.
  - Hai lỗi xuất hiện sau khi phần mở/vẽ/lưu bản đồ đã chạy; vẫn phải sửa và chạy
    lại đầy đủ trước khi đóng Task 10.

## 4. Việc cần làm tiếp theo, theo thứ tự

### P0 — Ổn định E2E Task 10

1. Sửa vòng làm mới danh sách feature để locator/nút không bị thay DOM liên tục khi
   dữ liệu và bbox không đổi; thêm test chống hồi quy cho click feature đã lọc.
2. Làm rõ trạng thái đóng phiếu phân loại trên WebKit; bảo đảm nút Đóng kết thúc
   transition/state trước khi tiếp tục đo.
3. Chạy lại Chromium và WebKit iPad, sau đó regression GPS, route, ảnh, import,
   comparison, export và version/supersede.
4. Cập nhật bằng chứng thật vào `docs/14_RELEASE_CHECKLIST.md`; chỉ đánh dấu đạt khi
   toàn bộ cổng xanh.

### P0 — Cổng bắt buộc trước production

1. Field test trên iPad/iPhone thực theo `docs/12_FIELD_TEST_PROTOCOL.md`.
2. Restore staging từ backup PostgreSQL + MinIO và đối chiếu manifest/hash/audit.
3. Thay/xác nhận địa giới 75 xã bằng hồ sơ nguồn có thẩm quyền.
4. Nghiệm thu provider tile/route, attribution, điều khoản sử dụng, domain/API/quota
   và khóa đã giới hạn trong môi trường triển khai.
5. Chạy Gitleaks trong CI và lưu bằng chứng release.

### P1 — Quyết định nghiệp vụ còn thiếu

- Chọn hosting chính thức và mẫu Excel cuối cùng.
- Chốt cơ sở xử lý/điểm tập kết thật và một tuyến chuẩn để đối chứng route/GPS.
- Chốt ngưỡng sai số GPS, ngưỡng cảnh báo chênh lệch và công thức từng hợp đồng.
- Kiểm tra mật độ/va chạm tên xã ở zoom toàn tỉnh và trên thiết bị màn hình nhỏ;
  tinh chỉnh mức ẩn/hiện nếu người dùng thấy quá dày.

## 5. Cách bắt đầu phiên sau

```bash
cd "/Users/thanh/PHAN MEM/Dovehientruong"
git status --short
git log -5 --oneline
mise install
pnpm doctor:services
pnpm dev
```

Kiểm tra nhanh:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright test tests/e2e/milestone-one.spec.ts --project=chromium
pnpm exec playwright test tests/e2e/milestone-one.spec.ts --project=webkit-ipad
```

Lưu ý: integration/performance/E2E phải dùng `dove_field_test` và API cổng 3100;
không đưa fixture vào database người dùng `dove_field`.

## 6. Tệp nên đọc trước khi sửa tiếp

1. `AGENTS.md` và `.codex/rules.md`.
2. `README.md`, `docs/01_PRD.md`, `docs/07_TEST_PLAN.md`.
3. `docs/08_IMPLEMENTATION_PLAN.md`, phần Task 10.
4. `docs/14_RELEASE_CHECKLIST.md`.
5. `docs/PROJECT_CONTEXT.md` nếu cần lịch sử/ADR chi tiết.

Các tệp gần lỗi E2E cần xử lý: `tests/e2e/milestone-one.spec.ts`, khu vực bộ lọc/
danh sách feature trong `apps/web/src/map/` và phiếu phân loại capture draft.

## 7. Nguyên tắc không được phá vỡ

- Không commit `.env`, token, mật khẩu thật hoặc URL có chữ ký.
- Không xóa cứng dữ liệu nghiệp vụ; không sửa trực tiếp chứng cứ hoặc geometry gốc.
- Không tạo geometry cho 12 khu vực cũ và không suy diễn chúng từ 75 xã/phường.
- Không gọi trực tiếp Google/Mapbox/OSRM từ component; luôn qua adapter/provider.
- Không đánh dấu production-ready nếu E2E, field test hoặc restore staging chưa có
  bằng chứng đạt.
