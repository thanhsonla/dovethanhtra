# ADR-011: Vòng đời dữ liệu lõi Mốc 1

- Trạng thái: Accepted
- Ngày: 18/07/2026

## Bối cảnh

Mốc 1 cần hồ sơ và danh mục dùng được, đồng thời phải giữ nền tảng truy vết cho các
phép đo và bằng chứng ở mốc sau. Danh mục có thể thay đổi nhưng hồ sơ cũ không được
đổi công thức theo cấu hình mới. Nhiều yêu cầu sửa đồng thời cũng không được âm thầm
ghi đè nhau.

## Quyết định

- Mỗi hồ sơ thuộc một `owner_id`, lưu snapshot ranh giới địa bàn tại thời điểm tạo và
  dùng `version` làm optimistic concurrency token qua `ETag`/`If-Match`.
- Hồ sơ chỉ xóa mềm. Trạng thái `locked` được dành sẵn trong schema nhưng thao tác
  khóa/mở khóa chưa triển khai trước Mốc 5.
- Khi thêm công tác, máy chủ chép đơn vị, mã/phiên bản và cấu hình công thức từ
  `work_type` vào `formula_snapshot`. Ngừng kích hoạt danh mục không làm hỏng công
  tác đã có.
- Mutation hồ sơ, công tác và danh mục ghi `audit_event` trong cùng transaction.
  Bảng audit có trigger cấm update/delete.
- Mốc 1 dùng tài khoản bootstrap giả cho local/test. Không cung cấp API quản trị người
  dùng và không đưa secret production vào repository.
- Seed địa bàn chỉ là fixture kỹ thuật có nhãn cảnh báo, không phải ranh giới hành
  chính chính thức và không được dùng cho phép đo.

## Hệ quả

Các mốc đo đạc có thể dựa trên snapshot ổn định và lịch sử append-only. Mỗi thay đổi
qua API tốn thêm một bản ghi audit, nhưng đổi lại có dấu vết cùng transaction. Dữ liệu
ranh giới thật vẫn phải được người dùng cung cấp và kiểm định trước Mốc 2.
