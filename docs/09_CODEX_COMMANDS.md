# 09. Hướng dẫn triển khai bằng Codex

## 1. Nguyên tắc giao việc

- Mỗi lệnh chỉ xử lý một mốc hoặc một lát cắt nhỏ.
- Yêu cầu Codex đọc tài liệu liên quan và nêu kế hoạch trước khi sửa.
- Yêu cầu chạy kiểm thử và ghi rõ tệp thay đổi.
- Không cho phép tự mở rộng scope hoặc thay công thức.
- Sau mỗi mốc, cập nhật `docs/PROJECT_CONTEXT.md`.

## 2. Lệnh khởi tạo repository

```text
Hãy đọc toàn bộ AGENTS.md, README.md, docs/01_PRD.md, docs/05_ARCHITECTURE_API.md,
docs/07_TEST_PLAN.md và docs/08_IMPLEMENTATION_PLAN.md. Chỉ thực hiện Mốc 0.

Trước khi sửa, hãy đề xuất cấu trúc repository, lựa chọn framework cụ thể,
package manager, chiến lược migration và test. Nêu rõ ưu/nhược điểm và ghi ADR.
Sau khi tôi đồng ý, mới khởi tạo dự án. Không đưa secret thật vào repository.
Kết thúc phải chạy lint, typecheck, test, build và báo cáo kết quả.
```

## 3. Lệnh Mốc 1 — Hồ sơ và danh mục

```text
Thực hiện Mốc 1 trong docs/08_IMPLEMENTATION_PLAN.md. Đọc schema.sql và
config/work-catalog.example.json trước khi làm. Xây theo lát cắt dọc từ migration,
repository/service, API đến giao diện. Không làm bản đồ hoặc route trong mốc này.

Bắt buộc có kiểm thử quyền, validation thời kỳ, soft delete, audit và trường hợp
ngừng loại công tác nhưng hồ sơ cũ vẫn dùng được. Dùng dữ liệu mẫu Mộc Châu.
```

## 4. Lệnh Mốc 2 — Bản đồ và phép đo

```text
Thực hiện Mốc 2. Đọc docs/04_CALCULATION_RULES.md và docs/07_TEST_PLAN.md.
Dùng MapLibre qua BasemapProvider; tuyệt đối không gọi mt1.google.com.

Triển khai point/line/polygon, nhiều phép đo cho một công tác, tính tạm ở client
và tính chính thức bằng PostGIS. Giữ rawGeometry, normalizedGeometry, rule code
và version. Tạo fixture tuyến 1 km, polygon 1 ha, polygon tự cắt, overlap và
geometry ngoài ranh giới. Không đánh dấu hoàn thành nếu chưa chạy các test này.
```

## 5. Lệnh Mốc 3 — Cự ly vận chuyển

```text
Thực hiện Mốc 3 theo RoutingProvider. Trước tiên tạo fake provider cho test,
sau đó mới thêm Mapbox adapter. Không để UI gọi Mapbox trực tiếp.

Phải lưu route source, provider, profile, waypoints, legs, geometry, thời điểm,
distance một chiều, returnFactor, tripCount và transportedWeight. Tính lại route
phải tạo phiên bản mới. Viết test timeout, no route, giới hạn waypoint, công thức
xe.km, tấn.km và cự ly gia quyền.
```

## 6. Lệnh Mốc 4 — GPS và ngoại tuyến

```text
Thực hiện Mốc 4. Thiết kế local-first draft bằng IndexedDB và mutation queue có
idempotency key. Không cache Google tiles trái điều kiện. Raw GPS track là bất biến;
lọc nhiễu tạo normalized track riêng và lưu rule version.

Viết E2E cho mất mạng khi đang vẽ, reload, đồng bộ lặp lại, xung đột hồ sơ đã khóa,
upload ảnh dở và resume. Kiểm tra giao diện ở viewport iPad và điện thoại.
```

## 7. Lệnh Mốc 5 — Đối chiếu và xuất

```text
Thực hiện Mốc 5. Dùng công thức trong docs/04_CALCULATION_RULES.md; không suy luận
sai phạm từ cảnh báo. Excel phải có sheet Hồ sơ, Công tác, Phép đo, Nguồn số liệu,
Đối chiếu và Nhật ký xuất. GeoJSON phải giữ caseId, workItemId, measurementId,
method, status, unit và calculationVersion.

Khi khóa hoặc xuất, tạo snapshot/hash. Viết test nguồn bằng 0, làm tròn, bản
superseded không cộng tổng và hồ sơ khóa không sửa được qua API.
```

## 8. Prompt review sau mỗi mốc

```text
Hãy review mốc vừa hoàn thành theo AGENTS.md và docs/07_TEST_PLAN.md. Chỉ review,
chưa sửa. Tập trung vào: sai công thức, mất truy vết, geometry/GPS, quyền truy cập,
idempotency, secret, điều kiện nhà cung cấp, hiệu năng bản đồ và test còn thiếu.

Phân loại phát hiện Critical/High/Medium/Low; nêu tệp, nguyên nhân, ảnh hưởng,
cách tái hiện và đề xuất sửa nhỏ nhất. Sau đó lập danh sách sửa theo thứ tự.
```

## 9. Prompt sửa sau review

```text
Dựa trên báo cáo review đã thống nhất, sửa lần lượt Critical và High trước.
Không refactor rộng ngoài phạm vi nếu không cần để khắc phục. Mỗi lỗi phải có test
tái hiện trước hoặc test chứng minh sau sửa. Chạy toàn bộ quality gate và cập nhật
PROJECT_CONTEXT. Báo rõ lỗi Medium/Low còn lại, không che giấu.
```

## 10. Prompt kết thúc phiên

```text
Trước khi kết thúc, hãy cập nhật docs/PROJECT_CONTEXT.md với trạng thái, quyết định,
việc còn lại và lệnh kiểm thử. Tóm tắt tệp thay đổi, test đã chạy, kết quả và rủi ro.
Không tự bắt đầu mốc tiếp theo.
```
