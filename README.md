# Ứng dụng kiểm tra khối lượng hiện trường — MVP v1

## 1. Mục tiêu

Xây dựng ứng dụng web/PWA hỗ trợ kiểm tra khối lượng thực tế trên bản đồ đối với các dịch vụ công ích đô thị, trước mắt gồm:

1. Dịch vụ vệ sinh môi trường.
2. Dịch vụ vận chuyển và xử lý rác thải.
3. Dịch vụ chăm sóc cây xanh, hoa cảnh.
4. Dịch vụ duy trì hệ thống điện chiếu sáng.
5. Dịch vụ chỉnh trang đô thị khác.

Mỗi địa bàn/huyện được quản lý bằng một hoặc nhiều **hồ sơ kiểm tra**. Mỗi hồ sơ có nhiều công tác; mỗi công tác có nhiều phép đo điểm, tuyến, vùng hoặc lộ trình. Kết quả được tổng hợp và đối chiếu với khối lượng hợp đồng, báo cáo hoặc nghiệm thu.

## 2. Phạm vi MVP đã chốt

- Quản lý hồ sơ theo huyện/địa bàn và thời kỳ kiểm tra.
- Danh mục năm nhóm dịch vụ, cho phép tự thêm loại công tác.
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
- Bản đồ nền được truy cập qua lớp `BasemapProvider`; không gọi trực tiếp `mt1.google.com`.
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

Tệp kỹ thuật khởi tạo:

- `database/schema.sql` — lược đồ PostgreSQL/PostGIS ban đầu.
- `api/openapi.yaml` — hợp đồng API khung.
- `config/work-catalog.example.json` — danh mục dịch vụ/công tác mẫu.
- `AGENTS.md` và `.codex/rules.md` — nguyên tắc bắt buộc khi Codex làm việc.
- `LICENSE.md` — phạm vi sử dụng nội bộ/cá nhân và lưu ý thành phần bên thứ ba.

## 5. Cách bắt đầu bằng Codex

Sao chép toàn bộ thư mục vào repository mới, mở tại thư mục gốc và dùng lệnh khởi động trong `docs/09_CODEX_COMMANDS.md`. Codex phải đọc `AGENTS.md`, `README.md`, `docs/01_PRD.md` và `docs/08_IMPLEMENTATION_PLAN.md` trước khi tạo mã nguồn.

Không yêu cầu Codex xây toàn bộ ứng dụng trong một lượt. Mỗi lượt chỉ thực hiện một mốc có tiêu chí nghiệm thu và chạy kiểm thử trước khi chuyển mốc tiếp theo.

### Chạy Mốc 5

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

`pnpm dev` dùng cấu hình giả dành riêng cho local trong `.env.example`, khởi động
PostgreSQL/PostGIS và MinIO, chạy migration đến Mốc 5 và seed dữ liệu local, sau đó mở API tại cổng
`3000` và web tại cổng `5173`. Đăng nhập local bằng tài khoản giả trong
`.env.example`. Không dùng các giá trị này cho staging hoặc production.

Mốc 2 bổ sung không gian MapLibre ba vùng, hai nền kỹ thuật local qua
`BasemapProvider`, vẽ/sửa điểm–tuyến–vùng và phép đo chính thức bằng PostGIS. Các
nền local không gọi tile ngoài và không thay thế bản đồ địa chính; ranh giới seed
chỉ là fixture kỹ thuật.

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
ID truy vết. Mỗi lần xuất lưu snapshot, hash tệp, actor, thời gian và audit. Chưa
triển khai các công việc ổn định/field-test/backup của Mốc 6.

Có thể cấu hình một style MapLibre được cấp phép qua `VITE_BASEMAP_STYLE_URL`,
`VITE_BASEMAP_LABEL` và `VITE_BASEMAP_ATTRIBUTION`. Cả URL và attribution phải có;
nếu tải lỗi, ứng dụng tự trở về nền kỹ thuật local. Không đặt secret thật trong
`.env.example`; public browser token vẫn phải được giới hạn domain/API/quota.

Nhập ranh giới chính thức sau khi migration đã chạy:

```bash
pnpm exec dotenv -e .env.example -- pnpm db:admin-area:import -- /duong/dan/ranh-gioi.geojson
```

Định dạng được minh họa tại `config/admin-area-import.example.geojson`. Đây chỉ là
ví dụ schema, không phải dữ liệu địa giới chính thức. Import yêu cầu EPSG:4326,
geometry hợp lệ, metadata nguồn/phiên bản và sẽ lưu SHA-256 của tệp nguồn.

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
