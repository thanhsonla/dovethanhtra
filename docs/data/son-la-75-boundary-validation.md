# Biên bản kiểm tra gói địa giới 75 xã, phường Sơn La

- Ngày kiểm tra: 19/07/2026
- Phiên bản: `son-la-75-qdt19-2025-gis-20260311-86361845`
- SHA-256 gói nhập:
  `3bf730467596baa1e72f17f88679c008e93ff4fd54ca4e7072ca04fcaa243c39`
- Hệ tọa độ: EPSG:4326

## Kết quả cấu trúc và hình học

| Kiểm tra                       |   Kết quả |
| ------------------------------ | --------: |
| Tổng đơn vị                    |        75 |
| Mã duy nhất                    |        75 |
| Xã                             |        67 |
| Phường                         |         8 |
| Hình học `ST_IsValid = true`   |        75 |
| Hình học sai SRID 4326         |         0 |
| Phiên bản nguồn/hash khác nhau |         0 |
| Import lần đầu                 |   75 thêm |
| Import lặp                     | 75 bỏ qua |

Nguồn ban đầu có một self-intersection ở `03760 / Xã Mường Bám`, do chuỗi A-B-A
quay lại sau một điểm. Bản chuẩn hóa bỏ đúng hai tọa độ quay lại đã thẩm định. Gói
giữ toàn bộ hình học gốc, chuỗi tọa độ, thao tác và lý do trong
`geometryNormalizations`; metadata trong PostgreSQL cũng giữ lý do. Không dùng
`ST_MakeValid`.

## Kiểm tra topology liên xã

Tổng diện tích từng xã là `14.111.242.613,97 m²`; diện tích hợp nhất là
`14.111.221.825,58 m²`. Có 63 cặp chồng lấn, trong đó 49 cặp lớn hơn `1 m²`, tổng
phần giao của các cặp này là `20.783,40 m²` (xấp xỉ `0,000147%` tổng diện tích).
Năm cặp lớn nhất:

| Mã A  | Mã B  | Diện tích giao (m²) |
| ----- | ----- | ------------------: |
| 03997 | 04000 |           13.997,96 |
| 03980 | 03982 |            3.699,30 |
| 03979 | 03985 |            1.167,38 |
| 04000 | 04033 |              545,51 |
| 03985 | 04045 |              538,82 |

Không tự động cắt hoặc phân xử phần chồng lấn. Đây là sai số/rủi ro của nguồn hình
học tham khảo và phải được thay bằng `sourceVersion` mới khi nhận hồ sơ địa giới có
thẩm quyền. Chưa thể kết luận độ phủ/gap pháp lý vì không có polygon tỉnh chính thức
cùng phiên bản để làm chuẩn đối chiếu.
