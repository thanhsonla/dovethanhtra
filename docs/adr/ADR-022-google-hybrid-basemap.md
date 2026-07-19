# ADR-022: Nền vệ tinh có nhãn mặc định và Google tùy chọn

- Trạng thái: Accepted
- Ngày: 19/07/2026

## Bối cảnh

Người dùng cần ảnh vệ tinh có tên xã/phường, đường và địa điểm hành chính dễ đọc.
Ứng dụng tham chiếu `sonla-map-project` không dùng Google mà ghép `Esri World
Imagery` với một lớp reference trong Leaflet.
Google Map Tiles API yêu cầu session token, API key trong mọi request, attribution
theo viewport và không cho phép ứng dụng tự ý cache nội dung. Đưa khóa có billing
vào bundle PWA làm tăng nguy cơ lạm dụng quota; dùng các host tile Google không được
công bố chính thức cũng không bảo đảm giấy phép hoặc độ ổn định.

## Quyết định

- Nền mặc định không cần khóa ghép ba raster layer qua `BasemapProvider`: `Esri
World Imagery`, `World Boundaries and Places` và `World Transportation`. Cách này
  kế thừa mô hình ảnh + reference overlay của `sonla-map-project`, đồng thời bổ sung
  lớp tên địa danh/địa giới phù hợp yêu cầu hiện tại.
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

Ảnh vệ tinh và lớp reference Esri hiển thị ngay khi có Internet, không phụ thuộc
Google key. Google vẫn là lựa chọn nâng cao khi có tài khoản billing. Các nền ngoài
đều không hỗ trợ ngoại tuyến; phải theo dõi attribution, điều khoản và độ sẵn sàng
của nhà cung cấp trước mỗi đợt phát hành.
