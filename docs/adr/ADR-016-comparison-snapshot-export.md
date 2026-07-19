# ADR-016 — Đối chiếu theo nguồn, snapshot băm và export qua provider

- Trạng thái: Chấp nhận
- Ngày: 19/07/2026
- Phạm vi: Mốc 5

## Quyết định

- Khối lượng kiểm tra chỉ cộng measurement `confirmed`; không cộng draft,
  superseded hoặc deleted. Mỗi source quantity được đối chiếu độc lập theo đúng đơn vị.
- Chênh lệch dùng `I - S`; nguồn bằng 0 trả `NO_SOURCE_BASELINE`, không chia 0.
  Ngưỡng công tác ưu tiên hơn ngưỡng hồ sơ và chỉ tạo cảnh báo, không kết luận sai phạm.
- Giải trình là bản ghi riêng có thể liên kết attachment đã hoàn tất; nội dung không
  sửa số liệu nguồn hoặc kết quả kiểm tra.
- Khóa hồ sơ tạo snapshot SHA-256 từ ID, phiên bản, kết quả, nguồn và hash bằng chứng
  rồi mới đổi trạng thái. Mở khóa bắt buộc lý do và không xóa snapshot cũ.
- Chỉ hồ sơ đã khóa mới được export. Mỗi export tạo snapshot loại `export`, SHA-256
  của đúng byte tệp, metadata bộ lọc và audit. Tệp không chứa token, object key hoặc
  đường dẫn nội bộ.
- `ExportProvider` tách việc dựng tệp khỏi nghiệp vụ. Local dùng `exceljs@4.4.0`
  được pin để tạo workbook XLSX năm sheet; GeoJSON dùng JSON chuẩn và giữ ID truy vết.

## Hệ quả

- Số liệu UI, Excel và GeoJSON cùng lấy từ kết quả chính thức phía server.
- Khóa hồ sơ cũng chặn bắt đầu/hoàn tất attachment, nên dữ liệu dựng tệp không đổi
  giữa lúc đọc dataset và ghi snapshot export.
- Có thể chứng minh tệp thuộc snapshot nào dù byte tệp chỉ được trả trực tiếp ở MVP.
- Export XLSX hiện tạo trong bộ nhớ và bị giới hạn 10 yêu cầu/phút/người dùng. Khi
  dữ liệu thực tế vượt ngưỡng vận hành sẽ thay provider bằng streaming/queue.
- ExcelJS có nhịp phát hành chậm và dependency chuyển tiếp cũ; CI audit là cổng bắt
  buộc, provider giúp thay thư viện mà không sửa mô-đun comparison.
