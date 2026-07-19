# ADR-022: Nền vệ tinh theo La Kinh và Google chính thức tùy chọn

- Trạng thái: Accepted
- Ngày: 19/07/2026

## Bối cảnh

Người dùng cần ảnh vệ tinh có tên xã/phường, đường và địa điểm hành chính dễ đọc.
Màn hình La Kinh Vệ Tinh của dự án `Minh Huyen` dùng Mapbox style
`satellite-streets-v12`, sau đó chèn raster `mt1.google.com` ngay trên lớp ảnh và
dưới các symbol label Mapbox. Phần chèn ảnh Google tạo hiệu ứng tốt nhưng dùng
endpoint không được tài liệu Google Map Tiles API công bố.

Google Map Tiles API yêu cầu session token, API key trong mọi request, attribution
theo viewport và không cho phép ứng dụng tự ý cache nội dung. Đưa khóa có billing
vào bundle PWA làm tăng nguy cơ lạm dụng quota; dùng các host tile Google không được
công bố chính thức cũng không bảo đảm giấy phép hoặc độ ổn định.

## Quyết định

- Khi có public token Mapbox hợp lệ, nền mặc định là raster render từ Mapbox
  `satellite-streets-v12`. Nền này giữ ảnh vệ tinh và label đã render, tương ứng với
  style nền cốt lõi của La Kinh Vệ Tinh mà không đổi renderer MapLibre hiện tại.
- Không sao chép request `mt1.google.com`. Mọi nguồn Google phải đi qua adapter
  Google Map Tiles API chính thức đã có session, key, attribution và kiểm soát quota.
- Khi thiếu token Mapbox/Google, fallback không cần khóa ghép ba raster layer qua
  `BasemapProvider`: Esri `World Imagery`, `World Boundaries and Places` và
  `World Transportation`.
- Hiển thị đầy đủ attribution Esri và các nhà cung cấp dữ liệu. Không gọi nền này là
  Google và không đưa các tile Esri vào service-worker cache.
- Dùng Google Map Tiles API chính thức, không dùng `mt1.google.com` hoặc URL tile
  không có trong tài liệu của nhà cung cấp.
- API server giữ `GOOGLE_MAP_TILES_API_KEY`, tạo session với `mapType=satellite`,
  `layerRoadmap`, `overlay=false`, `language=vi-VN`, `region=VN`. PWA chỉ gọi proxy
  same-origin qua interface `BasemapProvider`.
- Khóa thật chỉ đặt trong `.env.local`/secret manager. Google Cloud phải bật billing,
  giới hạn key cho riêng Map Tiles API và giới hạn IP/quota phù hợp.
- Route tile/viewport yêu cầu phiên đăng nhập, không ghi access log để tránh lưu tọa
  độ tile/viewport, trả `private, no-store` và không tham gia service-worker cache.
- Attribution tĩnh `Google Maps` luôn hiện. Khi bản đồ dừng di chuyển, adapter lấy
  attribution động theo viewport và escape dữ liệu trước khi đưa vào control.
- Nền Google chỉ xuất hiện khi backend có key. Nếu Google lỗi, UI chuyển về nền kỹ
  thuật local; Mapbox và các nền hiện có vẫn là lựa chọn độc lập.

## Hệ quả

Với token đang được cấu hình local, người dùng nhận nền Mapbox Satellite Streets
giống phần nền hợp lệ của La Kinh Vệ Tinh. Esri vẫn bảo đảm bản đồ có ảnh khi thiếu
token, còn Google chỉ bật khi có tài khoản billing và key chính thức. Các nền ngoài
đều không hỗ trợ ngoại tuyến; phải theo dõi attribution, điều khoản và độ sẵn sàng.
