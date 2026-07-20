# ADR-024: Khu vực quản lý chỉ là danh mục tên

- Trạng thái: Accepted
- Ngày: 20/07/2026

## Bối cảnh

ADR-023 tách 12 huyện/thành phố cũ khỏi 75 xã, phường hiện hành nhưng vẫn mô tả khu
vực quản lý như một lớp có nguồn và thời hạn riêng. Chủ dự án đã làm rõ rằng 12 khu
vực chỉ dùng để đặt tên, phân loại và lọc công việc; ứng dụng không cần dựng hoặc
hiển thị ranh giới riêng cho chúng.

## Quyết định

- Tạo danh mục `management_zone` không có geometry. Mỗi mục có mã, tên, thứ tự hiển
  thị, trạng thái, version và xóa mềm.
- Seed 12 tên: Thành phố Sơn La, Quỳnh Nhai, Thuận Châu, Mường La, Bắc Yên, Phù Yên,
  Mộc Châu, Yên Châu, Mai Sơn, Sông Mã, Sốp Cộp và Vân Hồ.
- `case_work_item.management_zone_id` chỉ phục vụ phân loại/lọc. Không dùng khu vực
  quản lý để kiểm tra trong/ngoài ranh giới, tính diện tích hoặc snapshot hồ sơ.
- `admin_area` và `inspection_case.boundary_snapshot` tiếp tục là nguồn ranh giới
  không gian. Bản đồ chỉ dùng bộ 75 xã, phường hiện hành đã chuẩn hóa hoặc dữ liệu
  thay thế có thẩm quyền sau này.
- Thêm, đổi tên, xóa mềm và phục hồi khu vực không làm thay đổi geometry. Không xóa
  khu vực đang có công tác hoạt động và mọi mutation phải có optimistic concurrency
  cùng audit.

## Hệ quả

Không còn yêu cầu gói geometry, source hash hoặc topology riêng cho 12 khu vực. Mã
nguồn không được suy ranh giới khu vực bằng cách gộp 75 xã. Phần mô tả khu vực quản
lý có geometry/version nguồn trong ADR-023 được thay thế bởi quyết định này; mọi
quy tắc bảo toàn dữ liệu và không cascade của ADR-023 vẫn giữ nguyên.
