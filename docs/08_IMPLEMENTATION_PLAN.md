# 08. Kế hoạch triển khai MVP

## 1. Chiến lược

Triển khai theo lát cắt dọc: mỗi mốc tạo ra một luồng dùng được từ giao diện đến database. Không xây toàn bộ frontend rồi mới làm backend.

## 2. Mốc 0 — Khởi tạo và quyết định kỹ thuật

**Thời lượng dự kiến:** 3–5 ngày.

### Công việc

- Khởi tạo monorepo hoặc repository thống nhất.
- Pin runtime/package manager; cấu hình lint, format, typecheck, test.
- Docker Compose cho PostgreSQL/PostGIS và object storage local.
- Cấu hình môi trường và secret mẫu.
- CI cơ bản.
- Ghi ADR cho framework, auth và hosting.

### Nghiệm thu

- Một lệnh chạy môi trường local.
- CI chạy lint/typecheck/test mẫu.
- Không có secret thật trong repository.
- Healthcheck API và database đạt.

## 3. Mốc 1 — Hồ sơ và danh mục

**Thời lượng dự kiến:** 1–2 tuần.

### Công việc

- Migration cho user, admin area, case, service group, work type, work item.
- Seed năm nhóm dịch vụ và công tác mẫu.
- API CRUD có validation/quyền.
- Giao diện danh sách/tạo hồ sơ, danh mục và thêm công tác.
- Audit cho tạo/sửa/trạng thái.

### Nghiệm thu

- Tạo hồ sơ Mộc Châu mẫu.
- Thêm ít nhất mười công tác thuộc năm nhóm.
- Danh mục ngừng sử dụng không phá hồ sơ cũ.

## 4. Mốc 2 — Bản đồ và phép đo

**Thời lượng dự kiến:** 2–3 tuần.

### Công việc

- MapLibre, basemap adapter, attribution.
- Vẽ point/line/polygon, sửa/undo/redo.
- API measurement, PostGIS validation và calculation.
- Cây lớp theo nhóm/công tác.
- Trạng thái draft/confirmed/superseded.
- Cảnh báo boundary và geometry invalid.

### Nghiệm thu

- Một công tác lưu ba phép đo.
- Tuyến 1 km và polygon 1 ha đạt dung sai.
- Sửa phép đo confirmed tạo version mới.
- Chuyển bản đồ nền không mất đối tượng.

## 5. Mốc 3 — Route vận chuyển

**Thời lượng dự kiến:** 1–2 tuần.

### Công việc

- Cơ sở xử lý, điểm tập kết và waypoints.
- RoutingProvider + Mapbox adapter.
- Giao diện chọn/tinh chỉnh route.
- Lưu provider, geometry, legs, distance và version.
- Công thức xe.km, tấn.km, cự ly gia quyền.
- Timeout, quota và provider failure handling.

### Nghiệm thu

- Tính/lưu được route đến khu xử lý.
- Hiển thị rõ nguồn cự ly.
- Tính lại không ghi đè tuyến cũ.
- Công thức mẫu trong `04_CALCULATION_RULES.md` đạt.

## 6. Mốc 4 — Hiện trường và ngoại tuyến

**Thời lượng dự kiến:** 2–3 tuần.

### Công việc

- PWA manifest/service worker.
- IndexedDB cho nháp và mutation queue.
- GPS point/track, pause/resume, accuracy.
- Ảnh hiện trường, upload hoàn tất và hash.
- Idempotency và conflict UI.

### Nghiệm thu

- Lưu nháp mất mạng và phục hồi sau reload.
- Đồng bộ lặp lại không trùng.
- Raw GPS không bị mất khi lọc.
- Ảnh dở không được đánh dấu hoàn tất.

## 7. Mốc 5 — Đối chiếu và xuất

**Thời lượng dự kiến:** 1–2 tuần.

### Công việc

- Nhập source quantity.
- Tổng hợp, chênh lệch, ngưỡng và giải trình.
- Xuất Excel nhiều sheet.
- Xuất GeoJSON.
- Snapshot/hash khi khóa và xuất.

### Nghiệm thu

- Số liệu tổng hợp khớp database và giao diện.
- Excel/GeoJSON mở được và giữ ID truy vết.
- Hồ sơ khóa ngăn sửa.

## 8. Mốc 6 — Ổn định và chạy thử

**Thời lượng dự kiến:** 1–2 tuần.

### Công việc

- Test bảo mật, hiệu năng và cross-browser.
- Backup/restore staging.
- Field test một địa bàn.
- Sửa lỗi, hướng dẫn sử dụng, checklist vận hành.
- Chốt backlog giai đoạn 2.

### Nghiệm thu

- Đạt cổng phát hành trong `07_TEST_PLAN.md`.
- Hoàn thành một hồ sơ mẫu end-to-end.
- Có biên bản ghi nhận sai khác route/GPS và quyết định cấu hình.

## 9. Backlog ưu tiên

### Must have

Hồ sơ, danh mục động, phép đo nhiều geometry, route, GPS, ảnh, đối chiếu, Excel/GeoJSON, audit, soft delete, offline draft.

### Should have

Import GeoJSON, sao chép hồ sơ, cảnh báo overlap, khóa/snapshot, conflict UI tốt.

### Could have sau MVP

KML/GPX đầy đủ, PDF/Word, dashboard, OSRM tự host, nhiều người dùng, phê duyệt điện tử, mẫu biên bản, AI tóm tắt bất thường.

## 10. Rủi ro và biện pháp

| Rủi ro                         |            Mức | Biện pháp                                             |
| ------------------------------ | -------------: | ----------------------------------------------------- |
| Dữ liệu đường thiếu/sai        |            Cao | Lưu provider/time, cho chỉnh waypoint, đối chiếu GPS  |
| Công thức hợp đồng khác nhau   |            Cao | Cấu hình/version, không hard-code                     |
| Mất mạng hiện trường           |            Cao | IndexedDB, idempotency, trạng thái sync               |
| Sai số GPS                     | Trung bình–cao | Lưu accuracy/raw track, cảnh báo, field test          |
| Dùng tile không đúng điều kiện |            Cao | Provider adapter, nguồn chính thức, quota/attribution |
| Scope tăng nhanh               |            Cao | Giữ Must have, mỗi mốc có DoD                         |
| Ảnh làm đầy thiết bị/kho       |     Trung bình | Giới hạn, thumbnail, upload queue và retention        |
| Địa giới thay đổi              |     Trung bình | Version + boundary snapshot                           |

## 11. Việc người dùng cần chuẩn bị trước Mốc 2–3

- Ranh giới huyện/xã dự kiến kiểm tra.
- Danh sách khu xử lý rác, trạm trung chuyển, tọa độ.
- 10–20 công tác dùng thực tế và đơn vị tính.
- Hai hồ sơ/hợp đồng mẫu để kiểm tra công thức.
- Một tuyến vận chuyển đã biết cự ly để đối chứng.
- Thiết bị iPad/iPhone sẽ dùng ngoài hiện trường.

## 12. Chuyển đổi map-first — kế hoạch Task 0–10

Kế hoạch này triển khai ADR-023 theo lát cắt nhỏ, giữ tương thích với dữ liệu Mốc
1–6. Mỗi task có commit và cổng kiểm thử riêng; không gộp migration phá hủy với đổi
giao diện.

### Task 0 — Khảo sát và đóng baseline — hoàn thành

- Kiểm tra runtime, dịch vụ local, test hiện hành, cấu trúc UI/API/database và ghi
  nhận mâu thuẫn đặc tả.
- Không thay đổi nghiệp vụ; baseline lint/typecheck/unit/integration/E2E phải xanh.

### Task 1 — ADR và đặc tả — hoàn thành

- Chốt map-first, đo trước–phân loại sau, `work_component`, `capture_draft`, 12 khu
  vực quản lý tách khỏi 75 xã/phường, bốn lĩnh vực hiển thị mặc định và chính sách
  mở/tải/chỉnh sửa.
- Đồng bộ PRD, UX, data model, API, security, test plan và project context.
- Nghiệm thu: không còn đặc tả bắt buộc chọn công tác trước khi đo; chưa có source
  code hoặc migration trong task này.

### Task 2 — Migration tương thích và seed — hoàn thành

- Thêm `work_component`, `capture_draft`, version/index/constraint và liên kết tùy
  chọn từ measurement. Backfill dữ liệu cũ có marker nguồn, không đổi kết quả.
- Seed bốn lĩnh vực hiển thị mặc định; giữ nhóm lịch sử. Seed 12 khu vực dưới dạng
  tên phân loại, không tạo geometry theo ADR-024.
- Nghiệm thu migration tiến/lùi trên database tạm; rollback từ chối nếu làm mất
  nháp hoặc chứng cứ mới.

### Task 3 — API cấu trúc danh mục — hoàn thành

- CRUD/rename/archive/restore khu vực, lĩnh vực, công tác và mục con; optimistic
  concurrency, owner/RBAC, audit và quy tắc không cascade.
- Integration bao phủ đổi tên giữ ID, xóa cha còn con, phục hồi và IDOR.
- ADR-024 tách `management_zone` khỏi `admin_area`; bản đồ tiếp tục chỉ dùng ranh
  giới 75 xã/phường. API triển khai version/ETag, audit và xóa mềm không cascade.

### Task 4 — API nháp và phân loại — hoàn thành

- CRUD `capture_draft`, idempotency, classify transaction, tính PostGIS và liên kết
  measurement. Nháp không tham gia aggregate/snapshot/export.
- Integration bao phủ retry, conflict, hồ sơ khóa và geometry lỗi.
- Migration lưu khóa/hash phân loại riêng; API hỗ trợ ETag, IDOR, xóa mềm/phục hồi,
  chọn hoặc tạo công tác/mục con và liên kết measurement trong một transaction.

### Task 5 — Khung giao diện map-first — hoàn thành

- Bản đồ toàn vùng, header/chữ gọn, toolbar dọc desktop/ngang mobile, drawer/bottom
  sheet cho dữ liệu, bộ lọc và chi tiết; menu nâng cao giữ GPS/route/ảnh/import.
- E2E Chromium/WebKit kiểm vùng bản đồ, 44 px, keyboard/ARIA và responsive.
- Đã tách shell khỏi drawer nội dung, đóng hoàn toàn mọi panel để trả vùng nhìn cho
  bản đồ; Escape đóng drawer, `aria-controls`/`aria-expanded` phản ánh trạng thái.
- Công cụ nhanh giữ tương thích với công tác hiện có trong Task 5. Lưu nháp độc lập,
  chọn/xóa phần hình học và state machine đầy đủ tiếp tục được triển khai ở Task 6.

### Task 6 — Công cụ vẽ nhanh

- Điểm/chiều dài/diện tích, marker đỉnh, chữ thập đỏ, lùi/tiến, xóa phần chọn, kết
  thúc và thẻ kết quả tạm bán trong suốt.
- Unit test state machine; E2E vẽ, sửa và lưu nháp khi online/offline.

### Task 7 — Phiếu phân loại sau khi đo

- Wizard gọn chọn/tạo khu vực → lĩnh vực → công tác → mục con tùy chọn; tên công tác
  để trống trong capture nhưng bắt buộc trước confirm, tên mục con bắt buộc nếu dùng.
- Hỗ trợ lưu nháp, lưu và tiếp tục, xử lý conflict và cảnh báo geometry.

### Task 8 — Lọc, chọn và chi tiết

- API/UI lọc theo mọi cấp, bbox/cursor; feature selection highlight/zoom và thẻ chi
  tiết gọn. Tổng mục con/công tác lấy từ máy chủ và chỉ gồm confirmed.
- Performance test 5.000 geometry và E2E tổ hợp filter.

### Task 9 — Mở, tải xuống và chỉnh sửa

- Mở toàn bộ metadata/history, tải một hoặc tập lọc GeoJSON có quyền/hash/audit;
  sửa nháp trực tiếp và sửa confirmed bằng supersede có lý do.
- Integration/E2E bao phủ IDOR, filter export, version và phục hồi.

### Task 10 — Tương thích, nghiệm thu và rollout

- Regression GPS/route/ảnh/import/comparison/export, migration drill, backup/restore,
  hướng dẫn sử dụng và feature flag/rollback UI nếu cần.
- Chỉ đóng khi lint, typecheck, unit, integration, performance, Chromium/WebKit và
  field test luồng đo–phân loại–lọc–tải–sửa đều có bằng chứng đạt.
