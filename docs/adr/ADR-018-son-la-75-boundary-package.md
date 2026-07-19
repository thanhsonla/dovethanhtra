# ADR-018: Gói địa giới 75 xã, phường Sơn La

- Trạng thái: Accepted
- Ngày: 19/07/2026

## Bối cảnh

Ứng dụng cần danh mục và hình học của 75 đơn vị hành chính cấp xã mới nhất của
tỉnh Sơn La. Dự án tham chiếu `sonla-map-project` có đủ 75 `MultiPolygon`, nhưng
nguồn hình học là kho dữ liệu cộng đồng, không phải hồ sơ địa giới pháp lý được cơ
quan có thẩm quyền bàn giao. Nghị quyết 1681/NQ-UBTVQH15 cũng yêu cầu tiếp tục đo
đạc, xác định phạm vi ranh giới trên thực địa để lập hồ sơ theo quy định.

## Quyết định

- Dùng Nghị quyết 1681/NQ-UBTVQH15 cho tên, loại đơn vị và thời điểm vận hành;
  dùng Quyết định 19/2025/QĐ-TTg cho mã đơn vị hành chính.
- Dùng hình học từ snapshot `geojson_11Mar2026` của
  `vietnamese-provinces-database`, commit
  `86361845ba60ee779905ef07f04d7db33c798d04`, giấy phép MIT, thông qua bản tổng
  hợp trong `sonla-map-project` có SHA-256
  `83c1ca1776ec1eae391a297a38261168c24ccb68643171ead6ea73d8b22e3e85`.
- Gắn nhãn hình học là dữ liệu tham khảo, không gọi là hồ sơ địa giới pháp lý hoặc
  dữ liệu địa chính. Khi nhận được bộ hồ sơ có thẩm quyền, phải nhập bằng
  `sourceVersion` mới; không ghi đè phiên bản hiện tại.
- Bộ chuyển đổi khóa checksum đầu vào, kiểm đủ 75 mã/tên và tạo GeoJSON EPSG:4326
  theo schema importer. PostGIS phát hiện duy nhất `03760 / Xã Mường Bám` có vòng
  một điểm A-B-A tự giao; bộ chuyển đổi bỏ đúng hai tọa độ quay lại đã thẩm định,
  đồng thời lưu hình học gốc đầy đủ, chuỗi tọa độ, thao tác và lý do trong gói.
  Không dùng `ST_MakeValid` và không giản lược hình học. PostGIS vẫn kiểm
  `ST_IsValid` trước khi lưu.
- Phiên bản nhập là `son-la-75-qdt19-2025-gis-20260311-86361845`, có hiệu lực từ
  `2025-07-01` và lưu SHA-256 đúng byte của gói đã nhập.

## Hệ quả

Môi trường hiện tại có thể chọn đúng 75 xã, phường và thực hiện cảnh báo không gian
trên một bộ dữ liệu tái lập, có nguồn và giấy phép rõ ràng. Độ chính xác pháp lý của
đường ranh vẫn là rủi ro được công khai; không dùng bộ này để giải quyết tranh chấp
ranh giới hoặc thay thế hồ sơ địa giới được phê duyệt. Kiểm tra topology ghi nhận
49 cặp chồng lấn trên 1 m², tổng 20.783,40 m²; hệ thống giữ nguyên và cảnh báo thay
vì tự động cắt hoặc phân xử ranh.
