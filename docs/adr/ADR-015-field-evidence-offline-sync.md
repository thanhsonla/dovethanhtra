# ADR-015 — GPS raw bất biến, upload xác minh và đồng bộ idempotent

- Trạng thái: Chấp nhận
- Ngày: 19/07/2026
- Phạm vi: Mốc 4

## Quyết định

- Mỗi lần pause GPS kết thúc một segment. Raw track dùng `MultiLineString`; từng
  điểm raw lưu riêng timestamp, accuracy, altitude/speed và không bị xóa khi lọc.
- GPS point dùng `Point`, lưu accuracy ở measurement và raw point; cả point/track
  đều đi qua mutation idempotent để hỗ trợ ghi khi mất mạng.
- Bản normalized loại điểm vượt ngưỡng accuracy phiên bản hóa; raw geometry và raw
  point luôn giữ nguyên. Server/PostGIS tính chiều dài chính thức.
- Web lưu draft và mutation queue trong IndexedDB. Service worker chỉ cache app
  shell cùng tài nguyên same-origin; không cache nền bản đồ bên thứ ba.
- Mutation offline gửi `Idempotency-Key` và `X-Device-Id`. Backend lưu payload hash;
  cùng key/payload trả kết quả cũ, cùng key khác payload trả xung đột.
- Ảnh tải bằng URL MinIO có thời hạn. Bản ghi ở trạng thái `pending` không được coi
  là bằng chứng. Khi complete, backend đọc object, kiểm tra size/MIME, tự tính SHA-256
  và chỉ chuyển `completed` khi khớp khai báo.

## Hệ quả

- Tạm dừng không tạo đoạn nối giả; lọc nhiễu không làm mất chứng cứ GPS.
- Upload dở và mutation xung đột có trạng thái rõ, có thể retry.
- IndexedDB không phải kho lưu dài hạn; người dùng vẫn phải đồng bộ và theo dõi dung lượng.
- DB buộc ảnh liên kết đúng một parent và chỉ chấp nhận MIME/hash thuộc allowlist.
