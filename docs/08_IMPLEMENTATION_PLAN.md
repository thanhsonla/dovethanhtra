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
