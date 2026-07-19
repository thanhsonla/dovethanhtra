# Nguồn dữ liệu địa giới Sơn La

Tệp `son-la-75-communes-2025.geojson` được chuẩn hóa từ
`sonla-map-project/public/data/son-la-75-communes.geojson`, SHA-256 nguồn
`83c1ca1776ec1eae391a297a38261168c24ccb68643171ead6ea73d8b22e3e85`.
Gói chuẩn hóa có SHA-256
`3bf730467596baa1e72f17f88679c008e93ff4fd54ca4e7072ca04fcaa243c39`.

- Tên và mã được đối chiếu với Nghị quyết 1681/NQ-UBTVQH15 và Quyết định
  19/2025/QĐ-TTg, hiệu lực vận hành từ 01/07/2025.
- Hình học lấy từ `vietnamese-provinces-database`, snapshot `geojson_11Mar2026`,
  commit `86361845ba60ee779905ef07f04d7db33c798d04`, giấy phép MIT.
- Hình học là dữ liệu tham khảo cho ứng dụng, không được mô tả là hồ sơ địa giới
  pháp lý hoặc dữ liệu địa chính. Nghị quyết 1681 yêu cầu tiếp tục đo đạc, xác định
  ranh giới thực địa và lập hồ sơ theo quy định.
- Bộ chuyển đổi không gọi `MakeValid` hoặc giản lược hình học. PostGIS phát hiện
  `03760 / Xã Mường Bám` có một vòng lặp một điểm A-B-A gây self-intersection. Bộ
  chuyển đổi chỉ bỏ hai tọa độ quay lại của vòng lặp đã thẩm định; hình học gốc đầy
  đủ, chuỗi tọa độ và lý do được giữ trong `geometryNormalizations` của chính gói.

Giấy phép nguồn: Copyright (c) 2021 Thang Le Quoc, MIT License. Toàn văn được lưu
tại `LICENSE.vietnamese-provinces-database.txt` trong cùng thư mục.
