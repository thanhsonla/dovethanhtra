# Ứng dụng kiểm tra khối lượng hiện trường — MVP v1

## 1. Mục tiêu

Xây dựng ứng dụng web/PWA hỗ trợ kiểm tra khối lượng thực tế trên bản đồ đối với các
dịch vụ công ích đô thị. Không gian nhập nhanh ưu tiên bốn lĩnh vực:

1. Vệ sinh môi trường.
2. Chiếu sáng.
3. Cây xanh.
4. Thoát nước thải.

Danh mục vẫn giữ các nhóm lịch sử như vận chuyển/xử lý rác và chỉnh trang đô thị;
nhóm mới có thể được thêm hoặc ngừng sử dụng mà không làm mất hồ sơ cũ.

Mỗi địa bàn/huyện được quản lý bằng một hoặc nhiều **hồ sơ kiểm tra**. Mỗi hồ sơ có nhiều công tác; mỗi công tác có nhiều phép đo điểm, tuyến, vùng hoặc lộ trình. Kết quả được tổng hợp và đối chiếu với khối lượng hợp đồng, báo cáo hoặc nghiệm thu.

## 2. Phạm vi MVP đã chốt

- Quản lý hồ sơ theo huyện/địa bàn và thời kỳ kiểm tra.
- Danh mục cấu hình được, có bốn lĩnh vực hiển thị nhanh và giữ nhóm lịch sử.
- Đo điểm, đếm số lượng, đo tuyến, đo diện tích và tính lộ trình vận chuyển.
- Một công tác được lưu nhiều phép đo độc lập.
- Gắn ảnh, ghi chú, vị trí, thời gian và độ chính xác GPS.
- Lưu ba loại cự ly: tự vẽ, định tuyến và GPS thực tế.
- Nhập khối lượng nguồn để so sánh với khối lượng kiểm tra.
- Cảnh báo dữ liệu thiếu, hình học lỗi, chồng lặp và chênh lệch lớn.
- Xuất Excel và GeoJSON; chuẩn bị kiến trúc cho PDF/Word ở giai đoạn sau.
- Lưu lịch sử chỉnh sửa và không xóa cứng dữ liệu nghiệp vụ.

## 3. Quyết định kiến trúc bắt buộc

- Dùng MapLibre GL JS làm bộ máy hiển thị bản đồ.
- Bản đồ nền được truy cập qua lớp `BasemapProvider`. Ngoại lệ ADR-022 cho phép
  adapter dùng `mt1.google.com`; component không được gọi trực tiếp nguồn này.
- Dùng Mapbox Directions ở giai đoạn đầu qua lớp `RoutingProvider`; có thể thay bằng OSRM/Valhalla.
- Lưu dữ liệu không gian trong PostgreSQL + PostGIS, hệ tọa độ lưu trữ WGS84/EPSG:4326.
- Tính toán chính thức ở phía máy chủ bằng PostGIS; phía trình duyệt chỉ tính tạm để phản hồi nhanh.
- Ứng dụng là PWA responsive; lưu nháp ngoại tuyến trong IndexedDB và đồng bộ có kiểm soát.
- Khóa API và bí mật không ghi vào mã nguồn hoặc tệp xuất cho người dùng.

## 4. Thứ tự đọc tài liệu

1. `docs/01_PRD.md` — phạm vi và yêu cầu nghiệp vụ.
2. `docs/02_UX_WORKFLOWS.md` — màn hình và quy trình thao tác.
3. `docs/03_DATA_MODEL.md` — mô hình dữ liệu.
4. `docs/04_CALCULATION_RULES.md` — quy tắc đo và công thức.
5. `docs/05_ARCHITECTURE_API.md` — kiến trúc và API.
6. `docs/06_SECURITY_OFFLINE_AUDIT.md` — bảo mật, ngoại tuyến, nhật ký.
7. `docs/07_TEST_PLAN.md` — kế hoạch kiểm thử.
8. `docs/08_IMPLEMENTATION_PLAN.md` — lộ trình triển khai.
9. `docs/09_CODEX_COMMANDS.md` — cách giao việc cho Codex.
10. `docs/10_USER_GUIDE.md` — hướng dẫn sử dụng MVP.
11. `docs/11_OPERATIONS_RUNBOOK.md` — phát hành, backup và phục hồi.
12. `docs/12_FIELD_TEST_PROTOCOL.md` — biên bản chạy thử thiết bị/địa bàn.
13. `docs/13_PHASE_2_BACKLOG.md` — backlog sau MVP.

Tệp kỹ thuật khởi tạo:

- `database/schema.sql` — lược đồ PostgreSQL/PostGIS ban đầu.
- `api/openapi.yaml` — hợp đồng API khung.
- `config/work-catalog.example.json` — danh mục dịch vụ/công tác mẫu.
- `AGENTS.md` và `.codex/rules.md` — nguyên tắc bắt buộc khi Codex làm việc.
- `LICENSE.md` — phạm vi sử dụng nội bộ/cá nhân và lưu ý thành phần bên thứ ba.

## 5. Cách bắt đầu bằng Codex

Sao chép toàn bộ thư mục vào repository mới, mở tại thư mục gốc và dùng lệnh khởi động trong `docs/09_CODEX_COMMANDS.md`. Codex phải đọc `AGENTS.md`, `README.md`, `docs/01_PRD.md` và `docs/08_IMPLEMENTATION_PLAN.md` trước khi tạo mã nguồn.

Không yêu cầu Codex xây toàn bộ ứng dụng trong một lượt. Mỗi lượt chỉ thực hiện một mốc có tiêu chí nghiệm thu và chạy kiểm thử trước khi chuyển mốc tiếp theo.

### Chạy Mốc 6

Yêu cầu Node.js 24.18.0, pnpm 11.9.0 và Docker đang chạy. Từ thư mục gốc:

```bash
mise install
pnpm doctor:services
pnpm install
pnpm dev
```

Repository có `mise.toml` và `.node-version` để pin runtime. Nếu không dùng `mise`,
có thể cài Node/pnpm bằng công cụ khác nhưng `pnpm doctor` vẫn phải đạt trước khi
cài dependency hoặc chạy kiểm thử.

Integration, performance và E2E tự tạo/dùng database riêng `dove_field_test` qua
`TEST_DATABASE_URL`; không ghi fixture vào `dove_field` của người dùng. API E2E chạy
ở cổng `3100`, tách khỏi API local cổng `3000` kể cả khi `pnpm dev` đang mở.

`pnpm dev` dùng cấu hình giả dành riêng cho local trong `.env.example`, khởi động
PostgreSQL/PostGIS và MinIO, chạy migration mới nhất và seed dữ liệu local, sau đó mở API tại cổng
`3000` và web tại cổng `5180`. Đăng nhập local bằng tài khoản giả trong
`.env.example`. Không dùng các giá trị này cho staging hoặc production.

Mốc 2 bổ sung không gian MapLibre ba vùng, hai nền kỹ thuật local qua
`BasemapProvider`, vẽ/sửa điểm–tuyến–vùng và phép đo chính thức bằng PostGIS. Các
nền local không gọi tile ngoài và không thay thế bản đồ địa chính; ranh giới seed
chỉ là fixture kỹ thuật. Hai lựa chọn **Kỹ thuật sáng/tối · kiểm thử** chỉ là nền
màu local để phát triển/fallback, không có ảnh vệ tinh, đường hoặc địa danh.

Mốc 3 bổ sung cơ sở xử lý, waypoint, route nhiều phương án, phiên bản route và công
thức xe.km/tấn.km/cự ly gia quyền. Local mặc định dùng `local-deterministic`, chỉ là
fixture đường thẳng kỹ thuật. Để dùng Mapbox Directions, đặt `ROUTING_PROVIDER=mapbox`
và cấp `MAPBOX_ACCESS_TOKEN` từ secret manager phía backend. GPS, ảnh, ngoại tuyến,
đối chiếu và xuất báo cáo vẫn chưa thuộc mốc này.

Mốc 4 bổ sung service worker/app shell same-origin, IndexedDB cho GPS draft và mutation
queue, GPS point/track nhiều segment với raw point bất biến, đồng bộ idempotent và upload ảnh gốc
trực tiếp vào MinIO. Ảnh chỉ hoàn tất sau khi backend kiểm tra size/MIME và tự tính
SHA-256.

Mốc 5 bổ sung khối lượng nguồn, đối chiếu theo measurement đã xác nhận, ngưỡng và
giải trình; khóa/mở khóa kèm snapshot SHA-256; xuất Excel năm sheet và GeoJSON giữ
ID truy vết. Mỗi lần xuất lưu snapshot, hash tệp, actor, thời gian và audit.

Mốc 6 bổ sung security headers/login rate limit, test IDOR, benchmark 10.000 geometry
và XLSX, backup/restore PostgreSQL + MinIO có manifest hash, runbook, hướng dẫn sử
dụng và biên bản field test. Phần kỹ thuật local/CI đã tự động hóa; field test trên
thiết bị và restore staging thật vẫn là cổng thủ công trước production.

Có thể cấu hình một style MapLibre được cấp phép qua `VITE_BASEMAP_STYLE_URL`,
`VITE_BASEMAP_LABEL` và `VITE_BASEMAP_ATTRIBUTION`. Cả URL và attribution phải có;
nếu tải lỗi, ứng dụng tự trở về nền kỹ thuật local. Không đặt secret thật trong
`.env.example`; public browser token vẫn phải được giới hạn domain/API/quota.

Theo ngoại lệ được chủ dự án chấp thuận tại ADR-022, ứng dụng mặc định dùng
**Google vệ tinh + địa danh** từ `mt1.google.com` với lớp hybrid `lyrs=y`, tiếng Việt.
URL chỉ tồn tại trong `BasemapProvider`, không được component gọi trực tiếp và không
được service worker cache. Mapbox `satellite-streets-v12`, Esri World Imagery kèm
reference layers, Google Map Tiles API chính thức và nền kỹ thuật local vẫn được giữ
làm các lựa chọn/fallback độc lập.

Khi có `VITE_MAPBOX_PUBLIC_TOKEN`, lựa chọn mặc định đổi thành **Google vệ tinh ·
chữ luôn thẳng**: adapter dùng ảnh Google `lyrs=s` ở dưới và các lớp nhãn vector của
Mapbox Satellite Streets ở trên. Nhãn được đặt `text-rotation-alignment: viewport`
và `text-pitch-alignment: viewport`, vì vậy vẫn nằm ngang theo màn hình khi xoay hoặc
nghiêng bản đồ. Nếu style nhãn không tải được, ứng dụng trở về Google hybrid raster.

Thẻ **Công tác đang đo** trên bản đồ ghi nhớ công tác trong phiên làm việc và tự hiện
đúng hành động Ghi điểm/Thêm đoạn/Thêm vùng/Mở lộ trình theo danh mục, không yêu cầu
chọn lại kiểu hình học. Có thể đổi hoặc tạo nhanh công tác ngay trên thẻ. Khi kết
thúc hình học, phiếu lưu tự sinh tên bộ phận, kế thừa các đầu vào công thức hợp lệ
gần nhất và cho chọn **Lưu và tiếp tục** hoặc **Lưu và xác nhận**. Phép đo có bất kỳ
cảnh báo nào chỉ được lưu nháp để rà soát; kết quả chính thức vẫn do máy chủ tính.
Bảng chi tiết chỉ xuất hiện khi cần, thanh trạng thái không che ảnh nền và attribution
vẫn được giữ. Tổng tạm, điểm/chữ thập đỏ, lùi/khôi phục điểm và tổng từng công tác
tiếp tục hiển thị trong không gian bản đồ.

Để bật lớp **Vệ tinh Mapbox**, đặt public token giới hạn domain/API/quota trong tệp
`.env.local` (tệp này bị Git bỏ qua): `VITE_MAPBOX_PUBLIC_TOKEN=pk...`. Ứng dụng dùng
Mapbox Satellite Streets qua `BasemapProvider`, hiển thị attribution Mapbox/
OpenStreetMap và không cache tile vệ tinh trong service worker.

Để bật lớp **Google vệ tinh + địa danh**, bật billing và Map Tiles API trong Google
Cloud, tạo key chỉ được dùng cho Map Tiles API và giới hạn theo IP/quota. Đặt key ở
`.env.local` (không đặt trong biến `VITE_*`):

```bash
GOOGLE_MAP_TILES_API_KEY=your-server-side-key
```

Khởi động lại API sau khi thêm key. Backend tạo session vệ tinh kèm `layerRoadmap`
với ngôn ngữ `vi-VN`, chuyển tiếp tile cho người dùng đã đăng nhập và lấy attribution
theo viewport. Tile Google không được cache; nền kỹ thuật local vẫn là fallback.

Nhập ranh giới chính thức sau khi migration đã chạy:

```bash
pnpm exec dotenv -e .env.example -- pnpm db:admin-area:import -- /duong/dan/ranh-gioi.geojson
```

Định dạng được minh họa tại `config/admin-area-import.example.geojson`. Đây chỉ là
ví dụ schema, không phải dữ liệu địa giới chính thức. Import yêu cầu EPSG:4326,
geometry hợp lệ, metadata nguồn/phiên bản và sẽ lưu SHA-256 của tệp nguồn.

Gói 75 xã, phường Sơn La đã đối chiếu tên/mã theo Nghị quyết
1681/NQ-UBTVQH15 và Quyết định 19/2025/QĐ-TTg có thể nhập bằng:

```bash
pnpm exec dotenv -e .env.example -- pnpm db:admin-area:import -- \
  data/admin-areas/son-la-75-communes-topology-2026.geojson
```

Hình học trong gói này là dữ liệu tham khảo có nguồn/giấy phép được ghi tại
`data/admin-areas/NOTICE.md`, không thay thế hồ sơ địa giới pháp lý. Có thể tái tạo
gói từ bản nguồn đã thẩm định (checksum bị khóa) bằng:

```bash
pnpm data:son-la:prepare -- /duong/dan/son-la-75-communes.geojson \
  data/admin-areas/son-la-75-communes-2025.geojson

pnpm data:son-la:prepare-area-targets -- /duong/dan/communes.json \
  data/admin-areas/son-la-75-area-targets-2026.json

pnpm exec dotenv -e .env.example -- pnpm db:admin-area:normalize-coverage -- \
  data/admin-areas/son-la-75-communes-2025.geojson \
  data/admin-areas/son-la-75-area-targets-2026.json \
  data/admin-areas/son-la-75-communes-topology-2026.geojson
```

Kết quả kiểm tra `ST_IsValid`, import lặp và chồng lấn liên xã được lưu tại
`docs/data/son-la-75-boundary-validation.md`. Bản gốc vẫn được giữ; pipeline topology
ghi từng phần giao đã cắt và dùng diện tích mục tiêu để chọn bên giữ.

12 khu vực theo tên huyện/thành phố cũ chỉ là danh mục phân loại công tác, được seed
từ `config/management-zones.example.json`. Danh mục này không có geometry, không
tạo lớp ranh giới riêng và không được gộp/suy diễn từ 75 xã, phường.

API Task 4 cho phép lưu geometry trước tại `POST /api/v1/cases/{caseId}/capture-drafts`
với `X-Device-Id` và `Idempotency-Key`, sau đó phân loại bằng
`POST /api/v1/capture-drafts/{draftId}/classify` kèm `If-Match`. Nháp chưa phân loại
không tham gia tổng; transaction phân loại mới tạo measurement và tính bằng PostGIS.

Task 5 chuyển không gian bản đồ sang khung map-first: sau header gọn, bản đồ chiếm
toàn bộ vùng nội dung; toolbar đo dọc trên desktop và ngang trên iPad/điện thoại.
Dữ liệu, bộ lọc/lớp và chi tiết/nâng cao nằm trong drawer hoặc bottom sheet đóng
được hoàn toàn. GPS, route, ảnh và import cũ vẫn nằm trong ngăn Nâng cao.

Task 6 cho phép chọn Điểm/Chiều dài/Diện tích và vẽ ngay, không cần tạo công tác
trước. Mỗi đỉnh có marker và chữ thập đỏ; có thể chọn một đỉnh để xóa, lùi/tiến và
xem kết quả tạm trên nền bán trong suốt. “Lưu nháp” ghi local-first vào IndexedDB,
tự đồng bộ khi có mạng và không đưa nháp chưa phân loại vào tổng chính thức. Việc
chọn khu vực, lĩnh vực, công tác và mục con sau khi đo thuộc Task 7.

Task 7 bổ sung “Lưu & phân loại” và nút trạng thái để mở lại nháp đã đồng bộ. Phiếu
gọn chọn Khu vực → Lĩnh vực, liên kết hoặc tạo Công tác/Mục con, tự chọn quy tắc cơ
bản đúng kiểu hình học và gửi một lần qua classify transaction. Cảnh báo PostGIS
được giữ trên phiếu để người dùng đọc trước khi đóng/tiếp tục; xung đột có nút tải
lại phiên bản máy chủ. “Lưu & tiếp tục đo” khởi động lại đúng công cụ vừa dùng.

Các cổng kiểm tra:

- `GET http://127.0.0.1:3000/api/v1/health/live`
- `GET http://127.0.0.1:3000/api/v1/health/ready`
- `http://127.0.0.1:3000/documentation`

Kiểm tra baseline:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm exec dotenv -e .env.example -- pnpm test:integration
pnpm exec dotenv -e .env.example -- pnpm test:performance
pnpm build
pnpm bundle:check
pnpm test:e2e
```

Quyết định kỹ thuật được ghi tại `docs/adr/`.

## 6. Điều kiện hoàn thành MVP

MVP chỉ được coi là hoàn thành khi:

- Tạo được hồ sơ kiểm tra và danh mục công tác.
- Một công tác lưu được ít nhất ba phép đo độc lập.
- Đo tuyến và vùng cho kết quả phía máy chủ đúng trong sai số kiểm thử.
- Tính và lưu được lộ trình đến khu xử lý; hiển thị rõ nguồn cự ly.
- Hoạt động được trên Chrome máy tính và Safari iPad/iPhone ở kích thước màn hình mục tiêu.
- Lưu nháp được khi mất mạng và đồng bộ không tạo bản ghi trùng.
- Xuất được Excel tổng hợp và GeoJSON hình học.
- Mọi thay đổi nghiệp vụ quan trọng xuất hiện trong nhật ký.
- Không còn lỗi nghiêm trọng hoặc lỗi bảo mật mức cao trong bộ kiểm thử phát hành.

## 7. Ngoài phạm vi MVP

- Tự động sinh kết luận thanh tra bằng AI.
- Điều hành phương tiện theo thời gian thực.
- Chấm công hoặc giám sát người lao động.
- Thanh toán, kế toán và kết nối trực tiếp sổ cái.
- Dẫn đường turn-by-turn như ứng dụng giao thông.
- Công nhận kết quả là số liệu đo đạc pháp lý nếu chưa có biên bản và thiết bị chuyên môn tương ứng.
