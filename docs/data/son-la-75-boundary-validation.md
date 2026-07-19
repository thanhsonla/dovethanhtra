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

## Kết quả phiên bản topology 19/07/2026

- SourceVersion:
  `son-la-75-qdt19-2025-gis-20260311-topology-20260719-v1`
- SHA-256:
  `ad1d369974aee3a2a35d96a9cf7dc368f3f5463b2d2e3aee5535b77be4c6cdd8`
- Diện tích mục tiêu: `son-la-area-targets-2026-07-01`, tổng 14.108,89 km².
- Thuật toán: `area-target-min-absolute-error-v1`, chi tiết tại ADR-019.

| Kiểm tra                                  |    Kết quả |
| ----------------------------------------- | ---------: |
| Tổng geometry / geometry hợp lệ           |    75 / 75 |
| Cặp giao trên 1 m²                        |          0 |
| Cặp giao trên ngưỡng 0,01 m²              |          0 |
| Cặp còn sai số floating point dưới ngưỡng |         24 |
| Sai số giao lớn nhất còn lại              | 0,00715 m² |
| Thao tác topology đã ghi provenance       |         62 |
| Đơn vị bị cắt ít nhất một phần giao       |         34 |
| Import lần đầu / import lặp               | 75 / 0 mới |
| Phiên bản ADR-018 được đặt hết hiệu lực   |         75 |

Hợp geometry của 75 đơn vị trước và sau chuẩn hóa không đổi quá 0,01 m². PostgreSQL
giữ 75 bản ADR-018 đến hết 18/07/2026 và 75 bản topology từ 19/07/2026; API chỉ trả
75 bản đang hiệu lực.
