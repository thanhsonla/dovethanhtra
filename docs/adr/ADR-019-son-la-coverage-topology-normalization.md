# ADR-019: Chuẩn hóa topology địa giới Sơn La theo diện tích mục tiêu

- Trạng thái: Accepted
- Ngày: 19/07/2026

## Bối cảnh

Gói ADR-018 có 49 cặp địa bàn giao nhau trên 1 m², tổng 20.783,40 m². Kiểm tra
upstream `vietnamese-provinces-database` tại commit mới nhất
`d10fd83c4bf7a5839a56706f1c04f13133271cfc` ngày 18/07/2026 cho thấy dữ liệu Sơn
La vẫn dùng snapshot `geojson_11Mar2026`; không có geometry Sơn La mới hơn để thay.

Bảng diện tích trong `sonla-map-project` được lập ngày 01/07/2026 từ PDF người dùng
cung cấp, có đủ 75 đơn vị và tổng 14.108,89 km². Đây là nội dung tham chiếu mới hơn
snapshot geometry, nhưng không phải hồ sơ ranh giới pháp lý.

## Quyết định

- Tạo gói diện tích mục tiêu có checksum, version và phân loại nguồn rõ ràng; không
  mô tả số liệu từng xã là hồ sơ địa giới được cơ quan có thẩm quyền bàn giao.
- Xử lý phần giao lớn nhất trước. Với mỗi cặp, thử hai phương án bỏ phần giao khỏi A
  hoặc B; chọn phương án có tổng sai lệch tuyệt đối so với diện tích mục tiêu nhỏ hơn.
  Nếu bằng nhau, bỏ khỏi mã hành chính lớn hơn để kết quả xác định và tái lập được.
- Chỉ dùng `ST_Difference` trên bản làm việc. Không sửa gói ADR-018; mỗi thao tác lưu
  mã giữ, mã cắt và diện tích giao. Hợp của 75 geometry trước/sau phải không đổi quá
  0,01 m² và mọi geometry phải qua `ST_IsValid`.
- Ngưỡng phần giao có ý nghĩa là 0,01 m². Sai số floating point nhỏ hơn ngưỡng được
  báo cáo, không tiếp tục cắt vô hạn.
- Gói mới dùng sourceVersion
  `son-la-75-qdt19-2025-gis-20260311-topology-20260719-v1`, hiệu lực vận hành từ
  19/07/2026. Import mới và đặt `valid_to = 18/07/2026` cho bản ADR-018 trong cùng
  transaction; chạy lặp không tạo bản ghi hoặc supersession trùng.

## Hệ quả

Ứng dụng chỉ trả 75 địa bàn đang hiệu lực, không còn cặp giao trên 0,01 m². Gói gốc,
checksum, diện tích mục tiêu và 62 thao tác topology vẫn được giữ để truy vết. Đây là
chuẩn hóa vận hành, không phân xử tranh chấp và phải được thay bằng sourceVersion mới
khi nhận hồ sơ địa giới có thẩm quyền.
