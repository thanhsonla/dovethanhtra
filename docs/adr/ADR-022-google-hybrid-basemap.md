# ADR-022: Cho phép Google hybrid trực tiếp theo La Kinh

- Trạng thái: Accepted
- Ngày: 19/07/2026

## Bối cảnh

Người dùng cần ảnh vệ tinh có tên xã/phường, đường và địa điểm hành chính dễ đọc.
Màn hình La Kinh Vệ Tinh của dự án `Minh Huyen` dùng Mapbox style
`satellite-streets-v12`, sau đó chèn raster `mt1.google.com` ngay trên lớp ảnh và
dưới các symbol label Mapbox. Phần chèn ảnh Google tạo hiệu ứng tốt nhưng dùng
endpoint không được tài liệu Google Map Tiles API công bố. Ngày 19/07/2026, chủ dự
án xác nhận chấp thuận thay đổi quy tắc để sử dụng endpoint này.

Google Map Tiles API yêu cầu session token, API key trong mọi request, attribution
theo viewport và không cho phép ứng dụng tự ý cache nội dung. Đưa khóa có billing
vào bundle PWA làm tăng nguy cơ lạm dụng quota; dùng các host tile Google không được
công bố chính thức cũng không bảo đảm giấy phép hoặc độ ổn định.

## Quyết định

- Khi có public token Mapbox hợp lệ, cung cấp thêm raster render từ Mapbox
  `satellite-streets-v12`. Nền này giữ ảnh vệ tinh và label đã render, tương ứng với
  style nền cốt lõi của La Kinh Vệ Tinh mà không đổi renderer MapLibre hiện tại.
- Cho phép `BasemapProvider` dùng trực tiếp
  `https://mt1.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}` và đặt làm nền mặc
  định. Dùng `lyrs=y` để ảnh vệ tinh và nhãn địa danh nằm trong cùng raster tile.
- Khi có public token Mapbox, ưu tiên biến thể `google-hybrid-upright`: dùng Google
  `lyrs=s` làm ảnh nền, giữ lớp đường/nhãn vector từ Mapbox Satellite Streets và ép
  `text-rotation-alignment`/`text-pitch-alignment` về `viewport`. Nhãn vì thế luôn
  hướng thẳng theo màn hình trong khi ảnh bản đồ vẫn xoay bình thường.
- Ngoại lệ không cho phép component gọi trực tiếp, không mở rộng sang endpoint khác,
  không cache/offline, không trích xuất hoặc phân tích dữ liệu từ tile.
- Google Map Tiles API chính thức vẫn được giữ làm lựa chọn ưu tiên khi backend có
  key/session hợp lệ; Mapbox, Esri và nền kỹ thuật tiếp tục là fallback.
- Khi thiếu token Mapbox/Google, fallback không cần khóa ghép ba raster layer qua
  `BasemapProvider`: Esri `World Imagery`, `World Boundaries and Places` và
  `World Transportation`.
- Hiển thị đầy đủ attribution Esri và các nhà cung cấp dữ liệu. Không gọi nền này là
  Google và không đưa các tile Esri vào service-worker cache.
- Ngoài ngoại lệ `mt1.google.com` nêu trên, không dùng URL Google không có trong tài
  liệu nhà cung cấp.
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

Người dùng nhận nền Google hybrid giống hình thức của La Kinh Vệ Tinh mà không cần
API key. Đổi lại, endpoint không có hợp đồng ổn định trong tài liệu Map Tiles API,
có thể thay đổi/bị chặn và không cung cấp attribution động theo viewport. Chủ dự án
chấp nhận rủi ro này; ứng dụng phải giữ fallback và không được coi đây là nền phù
hợp production cho đến khi pháp lý/điều khoản được xác minh.

Biến thể nhãn luôn thẳng phụ thuộc thêm vào public token và style Mapbox. Token phải
được giới hạn domain/API/quota; attribution Google, Mapbox và OpenStreetMap cùng được
hiển thị. Nếu thiếu token, Google hybrid raster vẫn hoạt động nhưng chữ đã ghép trong
ảnh sẽ xoay cùng bản đồ do giới hạn kỹ thuật của raster tile.
