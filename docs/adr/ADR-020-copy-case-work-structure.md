# ADR-020: Sao chép cấu trúc công tác không mang theo kết quả

- Trạng thái: Accepted
- Ngày: 19/07/2026

## Bối cảnh

FR-CASE-004 và backlog P1 yêu cầu dùng hồ sơ trước làm mẫu khi tạo hồ sơ mới. Phép
đo, tuyến, ảnh, khối lượng nguồn và kết quả đối chiếu là dữ liệu có giá trị chứng cứ;
sao chép ngầm các bản ghi này sẽ làm sai nguồn gốc và có nguy cơ cộng trùng.

## Quyết định

- `POST /cases` nhận tùy chọn `copyStructure` gồm `sourceCaseId` và tối đa 200
  `workItemIds`. Bỏ `workItemIds` nghĩa là sao chép toàn bộ công tác còn hiệu lực
  trong hồ sơ nguồn nếu tổng không quá 200; giao diện luôn gửi danh sách người dùng
  đã chọn.
- Máy chủ kiểm tra hồ sơ nguồn, hồ sơ đích và mọi công tác cùng thuộc owner. Tạo hồ
  sơ và sao chép cấu trúc trong một transaction; một ID sai làm rollback toàn bộ.
- Sao chép `work_type_id`, tên, đơn vị, `formula_snapshot` và `warning_threshold`.
  Công tác đích luôn ở `draft`; kỳ công tác được đặt `null` để không mang thời kỳ cũ.
- Không sao chép measurement/GPS/route, source quantity, attachment, comparison,
  snapshot hoặc audit của hồ sơ nguồn. Audit `structure_copied` chỉ lưu liên kết ID
  nguồn/đích và số lượng đã sao chép.
- Không cần migration vì các bảng hiện tại đã biểu diễn đủ quan hệ và snapshot.

## Hệ quả

Người dùng tái sử dụng cấu hình mà không làm mất provenance. Snapshot công thức được
giữ đúng như hồ sơ mẫu kể cả khi loại công tác đã ngừng kích hoạt. Tính năng sao chép
kết quả đo có chủ đích chưa được triển khai; nếu phát sinh ca thực tế phải có tiêu chí
nghiệm thu và quy tắc provenance riêng trước khi mở rộng ADR này.
