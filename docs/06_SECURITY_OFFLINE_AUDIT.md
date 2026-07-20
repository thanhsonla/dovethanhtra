# 06. Bảo mật, ngoại tuyến, bằng chứng và nhật ký

## 1. Mục tiêu bảo vệ

- Dữ liệu vị trí, ảnh và hồ sơ kiểm tra không bị truy cập trái phép.
- Kết quả không bị sửa mà không để lại dấu vết.
- Khóa API không bị lộ hoặc sử dụng vượt quota.
- Đồng bộ ngoại tuyến không mất hoặc nhân đôi dữ liệu.
- Có thể phục hồi sau lỗi thiết bị, thao tác nhầm hoặc sự cố dịch vụ.

## 2. Phân loại dữ liệu

### Mức 1 — Công khai/kỹ thuật

Danh mục đơn vị tính, nhóm dịch vụ, schema công khai.

### Mức 2 — Nội bộ

Ranh giới làm việc, danh mục công tác, số liệu kiểm tra chưa nhạy cảm.

### Mức 3 — Nhạy cảm nghiệp vụ

Ảnh hiện trường, vị trí, khối lượng đối chiếu, giải trình, bản nháp nhận xét.

### Mức 4 — Bí mật xác thực

Mật khẩu, token, secret, khóa mã hóa. Không xuất, không ghi log, không commit.

## 3. Kiểm soát truy cập

- MVP có tài khoản chủ hồ sơ; phiên hết hạn và có khả năng thu hồi.
- Backend kiểm tra quyền trên mọi endpoint theo `caseId`/entity; không tin dữ liệu ẩn trên giao diện.
- Hành động khóa/mở khóa/xuất hồ sơ yêu cầu xác thực còn hiệu lực.
- Chuẩn bị RBAC: `owner`, `editor`, `reviewer`, `viewer`, `catalog_admin`.
- Ngăn IDOR bằng truy vấn có điều kiện người dùng/quyền, không chỉ tra theo UUID.

## 4. Khóa API và nhà cung cấp bản đồ

- Mapbox/Google key được giới hạn theo domain, ứng dụng, API và quota khi có thể.
- Route request nên đi qua backend để kiểm soát quota và tránh lộ secret không dành cho trình duyệt.
- Thiết lập ngân sách/cảnh báo và giới hạn theo ngày.
- Endpoint tile không chính thức bị cấm, ngoại trừ `mt1.google.com` được chủ dự án
  chấp thuận tại ADR-022 và chỉ được gọi qua `BasemapProvider`, không cache/trích xuất.
- Attribution hiển thị động theo bản đồ nền.
- Không cache/offline nội dung của nhà cung cấp trái điều khoản; lớp offline dùng nguồn được cấp phép riêng.

## 5. Bảo vệ tệp và ảnh

- Tải trực tiếp vào object storage bằng URL có thời hạn; hoàn tất phải xác minh size, MIME và hash.
- Tên tệp hiển thị được làm sạch; object key do máy chủ sinh.
- Giới hạn định dạng, dung lượng và số tệp.
- Quét tệp độc hại khi triển khai thật.
- Thumbnail tạo từ bản sao; ảnh gốc bất biến.
- Tải xuống qua URL có thời hạn và kiểm tra quyền.

## 6. Ngoại tuyến và đồng bộ

### Dữ liệu lưu cục bộ

- Hồ sơ metadata cần thiết.
- Danh mục công tác.
- Geometry và biểu mẫu nháp.
- Ảnh chờ tải lên, có cảnh báo dung lượng.
- Hàng đợi mutation và trạng thái đồng bộ.
- Nháp thu thập chưa phân loại, kèm `localId`, phiên bản và thời điểm tạo; không lưu
  tọa độ vào log chẩn đoán.

Không lưu token dài hạn dưới dạng plaintext nếu có phương án an toàn hơn của nền tảng.

### Idempotency

Mỗi mutation có khóa duy nhất do client tạo. Máy chủ lưu payload hash và kết quả. Gửi lại cùng khóa/payload trả kết quả cũ; cùng khóa nhưng payload khác trả lỗi xung đột.

Tạo `capture_draft` và phân loại dùng hai cặp khóa/hash riêng. API không trả hash,
không ghi raw geometry/tọa độ vào audit và ràng buộc unique theo actor + device.

Client Task 6 lưu capture draft trong object store `captureDrafts` của IndexedDB,
ghi local trước khi gọi API và chỉ tự thử lại các mục `queued` khi nhận sự kiện
online. Mỗi nháp giữ nguyên `localId`, device ID và idempotency key qua mọi lần thử;
không dùng service worker để cache tile nền ngoài.

Client Task 7 chỉ cho phân loại sau khi nháp có server ID. Mỗi lần mở phiếu tạo một
khóa classify riêng và giữ nguyên khóa đó trong lần thử lại cùng payload; kết quả
classified được ghi lại IndexedDB. Khi API trả 409/423, nháp chuyển `conflict`, giữ
raw geometry và cho tải lại phiên bản máy chủ; không tự merge hoặc gửi lại với ETag
cũ. Cảnh báo geometry do máy chủ trả không bị ẩn và chặn tự động chuyển bước.

### Xung đột

- Bản nháp chưa xác nhận: có thể merge trường không xung đột.
- Geometry hoặc phép đo đã xác nhận: không merge tự động; tạo bản sửa mới.
- Nháp thu thập: chỉ merge metadata không xung đột; geometry xung đột yêu cầu chọn
  phiên bản, không tự nối hoặc thay thế.
- Hồ sơ đã khóa: từ chối mutation và giữ bản nháp cục bộ để người dùng xuất/đối chiếu.
- Ảnh: upload độc lập; liên kết chỉ hoàn tất sau khi máy chủ xác nhận hash.

### Trạng thái hiển thị

`local_only`, `queued`, `syncing`, `synced`, `conflict`, `failed`.

## 7. Nhật ký và tính toàn vẹn

- Audit event chỉ thêm mới, timestamp máy chủ.
- Lưu actor, entity, action, reason, trace ID và thay đổi trọng yếu.
- Không lưu token hoặc toàn bộ ảnh/geometry lớn trong audit JSON; lưu ID/hash/thay đổi thuộc tính cần thiết.
- Khi khóa hồ sơ, tạo `case_snapshot_hash` từ danh sách phiên bản đối tượng và kết quả tổng hợp.
- Khi xuất, lưu hash tệp và snapshot ID để chứng minh tệp thuộc trạng thái nào.
- Thêm/đổi tên/lưu trữ/phục hồi khu vực, lĩnh vực, công tác, mục con; phân loại nháp;
  sửa phiên bản và tải GeoJSON đều phải ghi audit trong transaction nghiệp vụ.
- Download một feature hoặc tập lọc phải kiểm quyền phía máy chủ, giới hạn số lượng,
  lưu bộ lọc/hash và không đưa URL ký hoặc object key vào audit.

## 8. Sao lưu và phục hồi

- Sao lưu database tự động hằng ngày; tần suất cuối cùng theo môi trường.
- Object storage bật versioning hoặc chính sách tương đương nếu khả thi.
- Mỗi quý hoặc trước đợt kiểm tra lớn, thực hiện phục hồi thử trên môi trường riêng.
- Ghi RPO/RTO trước production; đề xuất ban đầu RPO 24 giờ, RTO 8 giờ cho ứng dụng cá nhân, sau đó điều chỉnh.
- Xuất gói hồ sơ định kỳ gồm dữ liệu cấu trúc, GeoJSON, danh mục tệp và hash.

## 9. Threat model rút gọn

| Nguy cơ                     | Kiểm soát chính                                       |
| --------------------------- | ----------------------------------------------------- |
| Lộ khóa API                 | Giới hạn key, backend proxy, secret manager, quota    |
| Truy cập hồ sơ bằng ID      | Authorization server-side, test IDOR                  |
| Sửa phép đo không dấu vết   | Version, audit append-only, khóa hồ sơ                |
| Nhân đôi khi mạng chập chờn | Idempotency key và payload hash                       |
| Tệp giả mạo/độc hại         | MIME/size validation, hash, scan                      |
| Mất dữ liệu trên iPad       | Auto-save IndexedDB và đồng bộ trạng thái             |
| Route sai do dữ liệu đường  | Lưu provider/time, đối chiếu GPS, xác nhận người dùng |
| Cộng trùng tuyến/vùng       | Spatial overlap warning                               |
| XSS từ ghi chú/GeoJSON      | Validation, escaping, CSP                             |
| Dependency có lỗ hổng       | Lockfile, scan CI, lịch cập nhật                      |

## 10. Checklist trước production

- [ ] HTTPS và secure cookie/session.
- [ ] Không có secret trong repository hoặc build artifact.
- [ ] Key bản đồ/route được giới hạn và có quota.
- [ ] Kiểm thử quyền cho mọi endpoint có ID.
- [x] API security headers và same-origin CORS baseline được cấu hình; CSP của
      static host/reverse proxy phải xác minh lại trên production.
- [ ] Backup thành công và đã thử restore.
- [ ] Nhật ký không chứa token hoặc dữ liệu nhạy cảm không cần thiết.
- [ ] Xóa mềm/phục hồi hoạt động.
- [ ] Đồng bộ lặp lại không tạo bản ghi trùng.
- [x] Hồ sơ khóa không thể sửa bằng gọi API trực tiếp.

## 11. Trạng thái hardening Mốc 6

- Integration test dùng hai owner để kiểm IDOR đọc/sửa hồ sơ, comparison và audit.
- Login có rate limit theo IP; API response không cache và có defensive headers.
- Backup chứa database, object storage và SHA-256 manifest; restore drill dùng tài
  nguyên tạm và không ghi đè dữ liệu đang chạy.
- Các ô HTTPS/key quota/malware scan/field test vẫn là cổng môi trường production,
  không được coi là đóng chỉ bằng kiểm thử local.
