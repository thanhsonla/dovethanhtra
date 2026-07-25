# PROJECT_CONTEXT

## Trạng thái

- Phiên bản tài liệu: 1.2.
- Ngày chốt phạm vi gần nhất: 20/07/2026.
- Giai đoạn: Mốc 6 — hardening, benchmark, backup/restore local và tài liệu vận hành
  đã triển khai; field test thiết bị và restore staging còn là cổng trước production.
- Người dùng chính: một cán bộ thực hiện kiểm tra hiện trường; kiến trúc vẫn chuẩn bị cho nhiều người dùng về sau.

## Quyết định đã chốt

- Hình thức: web/PWA responsive cho máy tính, iPad và điện thoại.
- Công cụ hiển thị: MapLibre GL JS.
- Cơ sở dữ liệu: PostgreSQL + PostGIS.
- Định tuyến ban đầu: Mapbox Directions qua adapter.
- `mt1.google.com` chỉ được dùng theo ngoại lệ ADR-022 qua `BasemapProvider`, không
  gọi trực tiếp từ component và không cache; vẫn còn rủi ro điều khoản production.
- Một công tác có nhiều phép đo.
- Lưu riêng khối lượng nguồn và khối lượng kiểm tra.
- Tính chính thức ở máy chủ; trình duyệt chỉ hiển thị tạm.
- MVP xuất Excel và GeoJSON.
- Khối lượng kiểm tra chỉ tổng hợp measurement confirmed; đối chiếu từng nguồn,
  không chia phần trăm khi nguồn bằng 0 và không tự kết luận sai phạm.
- Export đi qua `ExportProvider`; ExcelJS 4.4.0 được pin sau adapter, mỗi tệp có
  snapshot/hash/audit và không chứa token hoặc object key.
- Monorepo dùng pnpm workspace, Node.js 24 LTS và TypeScript strict.
- Runtime local/CI được khóa bằng `mise.toml`, `.node-version`, `packageManager` và
  kiểm tra qua `pnpm doctor`; phiên bản hiện hành là Node 24.18.0, pnpm 11.9.0.
- Web dùng React/Vite; API dùng Fastify modular monolith.
- Query layer dùng Kysely/pg; migration dùng node-pg-migrate.
- Object storage local dùng MinIO; xác thực dùng cookie session phía máy chủ, hash
  session, Argon2id và CSRF double-submit.
- Kiểm thử dùng Vitest và Playwright; CI dùng GitHub Actions.
- Mốc 6 dùng benchmark tách riêng cho 10.000 geometry/XLSX; backup PostgreSQL/MinIO
  có SHA-256 manifest và restore drill chỉ dùng database/bucket tạm.
- Pipeline P1 giai đoạn 2 dùng import preview/commit, cursor+bbox, phục hồi xóa mềm,
  export job bền qua restart và quét ClamAV trước khi ảnh trở thành bằng chứng.
- CI áp ngân sách raw/gzip cho bundle; MapLibre được lazy-load và E2E xác nhận chưa
  tải mô-đun bản đồ trước thao tác mở bản đồ.
- Hồ sơ dùng owner authorization, xóa mềm và optimistic concurrency bằng
  `version`/`ETag`/`If-Match`.
- Công tác trong hồ sơ lưu snapshot cấu hình công thức; danh mục ngừng hoạt động
  không phá dữ liệu cũ.
- Audit là append-only và được ghi cùng transaction với mutation Mốc 1–2.
- Phép đo lưu hình học gốc bất biến và hình học chuẩn hóa riêng; hình học lỗi không
  bị tự động sửa và không thể xác nhận.
- Chiều dài/diện tích chính thức dùng PostGIS `geography`; kết quả lưu cùng mã và
  phiên bản quy tắc, đầu vào và đầu ra tính toán.
- Hiệu chỉnh phép đo đã xác nhận tạo phiên bản mới; phiên bản cũ chuyển
  `superseded`. Cảnh báo ngoài ranh giới/chồng lặp không tự cắt hoặc trừ hình học.
- Style kỹ thuật local của Mốc 2 chỉ còn phục vụ kiểm thử tự động, không hiển thị
  trong combobox bản đồ nền cho người dùng.
- Basemap được cấp phép có thể cấu hình bằng HTTPS style URL + attribution; lỗi tải
  style chuyển về Esri **Vệ tinh + địa danh**. Không có token nào được commit.
- Import địa giới yêu cầu FeatureCollection EPSG:4326, nguồn/phiên bản/ngày hiệu lực,
  lưu SHA-256 byte nguồn và từ chối ghi đè cùng phiên bản nếu hash thay đổi.
- Danh mục 75 xã, phường Sơn La dùng Nghị quyết 1681/NQ-UBTVQH15 và Quyết định
  19/2025/QĐ-TTg. Hình học snapshot 11/03/2026 là dữ liệu tham khảo MIT, không thay
  hồ sơ địa giới pháp lý; phiên bản nhập được chốt tại ADR-018.
- ADR-019 chuẩn hóa topology theo diện tích mục tiêu 01/07/2026: xử lý phần giao lớn
  nhất trước, chọn bên giữ để giảm sai lệch diện tích và giữ nguyên hợp geometry.
  Ngưỡng floating point là 0,01 m²; bản gốc không bị ghi đè.
- Không gian kiểm tra chuyển sang map-first: toolbar dọc desktop/ngang mobile,
  drawer/bottom sheet đóng được và ba công cụ nhanh điểm, chiều dài, diện tích.
- Quy trình mới cho phép lưu `capture_draft` trước khi phân loại theo Khu vực quản
  lý → Lĩnh vực → Công tác → Mục con → Phép đo. Nháp chưa phân loại không cộng tổng.
- 12 huyện/thành phố cũ chỉ là danh mục tên version hóa, không có geometry và không
  thay 75 xã/phường hiện hành. Bốn lĩnh vực mặc định là cấu hình hiển thị, không
  hard-code hoặc xóa nhóm cũ.
- Measurement confirmed chỉ sửa bằng phiên bản superseding; xóa cấu trúc là xóa
  mềm, không cascade chứng cứ. Chọn feature hỗ trợ mở, tải GeoJSON và chỉnh sửa theo
  quyền với hash/audit.

## Chưa chốt

- Nguồn hồ sơ địa giới pháp lý thay thế hình học tham khảo của 75 xã, phường Sơn La.
- Mẫu Excel đầu ra cuối cùng.
- Ngưỡng sai số GPS theo từng công tác.
- Ngưỡng cảnh báo chênh lệch mặc định.
- Công thức thanh toán/qui đổi chi tiết của từng hợp đồng.

## Nhật ký quyết định

| Ngày       | Mã      | Quyết định                                                            | Lý do                                                       |
| ---------- | ------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| 18/07/2026 | ADR-001 | Dùng hồ sơ trong một cơ sở dữ liệu thay cho mỗi huyện một tệp độc lập | Dễ tìm kiếm, sao lưu và đối chiếu chéo                      |
| 18/07/2026 | ADR-002 | Tách bản đồ nền khỏi dữ liệu đo                                       | Tránh phụ thuộc nhà cung cấp và bảo toàn dữ liệu nghiệp vụ  |
| 18/07/2026 | ADR-003 | Lưu ba nguồn cự ly                                                    | Không đánh đồng định tuyến với GPS thực tế                  |
| 18/07/2026 | ADR-004 | Không dùng AI trong phép tính cốt lõi                                 | Bảo đảm xác định, kiểm thử và truy vết                      |
| 18/07/2026 | ADR-005 | pnpm monorepo, Node.js 24 LTS và TypeScript strict                    | Một lockfile, runtime thống nhất và ít tooling thừa         |
| 18/07/2026 | ADR-006 | React/Vite cho web và Fastify cho API                                 | PWA responsive, validation/OpenAPI và mô-đun rõ ràng        |
| 18/07/2026 | ADR-007 | Kysely/pg và node-pg-migrate cho PostGIS                              | Giữ SQL không gian tường minh và migration kiểm thử được    |
| 18/07/2026 | ADR-008 | MinIO cho object storage local                                        | S3-compatible và thay provider qua adapter                  |
| 18/07/2026 | ADR-009 | Cookie session phía máy chủ thay Bearer JWT cho web                   | Không lưu bearer token dài hạn trong PWA                    |
| 18/07/2026 | ADR-010 | Vitest, Playwright và GitHub Actions                                  | Bao phủ unit, migration, Chromium/WebKit và cổng chất lượng |
| 18/07/2026 | ADR-011 | Snapshot danh mục, optimistic concurrency và audit cùng transaction  | Bảo toàn lịch sử và ngăn ghi đè âm thầm                     |
| 18/07/2026 | ADR-012 | Tách raw/normalized geometry, tính PostGIS và version hóa phép đo    | Bảo toàn chứng cứ, kết quả chính thức và lịch sử hiệu chỉnh |
| 19/07/2026 | ADR-013 | Cấu hình basemap và hash nguồn ranh giới                             | Đúng attribution, fallback an toàn và không ghi đè âm thầm  |
| 19/07/2026 | ADR-014 | RoutingProvider backend và phiên bản route bất biến                  | Giữ token phía server, nguồn cự ly và lịch sử tính lại       |
| 19/07/2026 | ADR-015 | GPS raw, upload xác minh và đồng bộ idempotent                       | Không mất bằng chứng khi lọc/retry hoặc upload dở            |
| 19/07/2026 | ADR-016 | Đối chiếu theo nguồn, snapshot hash và export qua provider          | Tổng đúng, khóa truy vết và thay được thư viện tạo tệp        |
| 19/07/2026 | ADR-017 | Cổng phát hành, backup/restore và field trial                       | Chứng minh phục hồi và không giả lập nghiệm thu thực địa      |
| 19/07/2026 | ADR-018 | Gói địa giới 75 xã, phường Sơn La                                  | Danh mục chính thức, hình học tham khảo có nguồn và version    |
| 19/07/2026 | ADR-019 | Chuẩn hóa topology và supersede địa giới Sơn La                    | Loại phần giao có quy tắc, giữ bản gốc và provenance           |
| 19/07/2026 | ADR-020 | Sao chép cấu trúc công tác không mang theo kết quả                 | Tái sử dụng cấu hình nhưng không nhân bản chứng cứ              |
| 19/07/2026 | ADR-021 | Pipeline dữ liệu P1 và vòng đời artifact                          | Import có preview, phục hồi, phân trang và export an toàn       |
| 19/07/2026 | ADR-022 | Cho phép Google hybrid trực tiếp theo La Kinh                    | Chủ dự án chấp thuận ngoại lệ mt1 qua adapter                    |
| 20/07/2026 | ADR-023 | Map-first và đo trước, phân loại sau                            | Giảm bước nhập nhưng giữ tổng chính thức và provenance           |
| 20/07/2026 | ADR-024 | 12 khu vực là nhãn tên, không có geometry                  | Không tạo ranh giới huyện cũ; bản đồ chỉ dùng 75 xã/phường       |
| 22/07/2026 | ADR-025 | Ẩn dashboard, dùng một không gian hồ sơ nội bộ và vào thẳng bản đồ | Giảm thao tác quản lý; backend vẫn giữ liên kết và audit          |
| 22/07/2026 | ADR-026 | Mục tiêu cloud: Vercel web, Render API/ClamAV, Supabase PostGIS và R2 | Giữ API/scanner phù hợp runtime lâu dài, same-origin proxy và tách dữ liệu/ảnh |
| 23/07/2026 | Render   | Triển khai Backend API lên Render.com theo Cách 1                | Kết nối Supabase PostGIS DB trực tiếp từ Render web service |
| 23/07/2026 | ADR-023 | Triển khai Thẻ Popover xem nhanh hình học khi di chuột trên bản đồ     | Tối ưu UX xem nhanh tên tuyến/đường, khối lượng đo và ảnh thực địa |
| 23/07/2026 | DataSync | Đồng bộ 100% dữ liệu đo thực địa local lên Supabase Production   | Chuyển toàn bộ 2 inspection cases, 70 work items, 106 measurements, 74 capture drafts |

Kế hoạch thực thi ADR-026 nằm tại `docs/14_CLOUD_DEPLOYMENT_PLAN.md`. Đây là kiến
thức triển khai backend chính thức trên Render.com (Cách 1). chỉ được mở sau staging, restore drill, field test
và các cổng bảo mật trong runbook.

## Trạng thái chuyển đổi map-first

- Task 0 đã đóng baseline môi trường và kiểm thử tại commit `27c0ac8`; không thay
  đổi nghiệp vụ.
- Task 1 đã chốt ADR-023 và đồng bộ PRD, UX, data model, API, security, test plan và
  kế hoạch Task 0–10.
- Task 2 đã thêm migration tương thích cho `work_component`, `capture_draft`, liên
  kết measurement và quan hệ trực tiếp từ công tác tới lĩnh vực/kiểu đo. Backfill
  giữ `work_type_id`, formula snapshot và kết quả cũ; rollback từ chối khi đã có dữ
  liệu map-first không thể biểu diễn trong schema cũ.
- Seed có đúng bốn nhãn hiển thị nhanh, thêm `WASTEWATER_DRAINAGE`, giữ nhóm vận
  chuyển/chỉnh trang lịch sử và 12 tên khu vực không geometry.
- Task 3 đã triển khai API CRUD/đổi tên/lưu trữ/phục hồi có version/audit cho khu
  vực tên, lĩnh vực, công tác và mục con.
- Task 4 đã triển khai CRUD `capture_draft`, idempotency riêng cho tạo/phân loại,
  optimistic concurrency, IDOR và transaction tạo/liên kết công tác, mục con,
  measurement. Raw geometry được giữ nguyên; nháp và measurement chưa confirmed
  không tham gia tổng.
- Task 5 đã chuyển UI sang shell map-first toàn vùng: header 64/58 px, toolbar dọc
  desktop và ngang tới iPad, control tối thiểu 44 px; Dữ liệu, Bộ lọc và Nâng cao
  là drawer/bottom sheet đóng hoàn toàn, hỗ trợ Escape và ARIA. GPS, route, ảnh,
  import và các luồng Mốc 1–6 vẫn được giữ trong Nâng cao.
- Task 6 đã nối toolbar chính với luồng đo trước–phân loại sau: Điểm/Chiều dài/Diện
  tích hoạt động khi chưa có công tác, marker đỉnh/chữ thập đỏ hỗ trợ chọn-xóa,
  lùi/tiến và kết quả tạm gọn. Capture draft được ghi IndexedDB trước, đồng bộ qua
  API bằng idempotency key, tự thử lại khi online và phục hồi nháp gần nhất. Luồng
  đo theo công tác cũ vẫn vào từ ngăn Dữ liệu.
- Task 7 đã thêm phiếu phân loại hậu kỳ từ “Lưu & phân loại” hoặc nút trạng thái
  nháp. Phiếu chọn Khu vực → Lĩnh vực → Công tác → Mục con, cho tạo Công tác/Mục
  con trong classify transaction, tự chọn rule đúng geometry và giữ phần nâng cao
  thu gọn. ETag/device/idempotency được giữ xuyên retry; 409/423 cho tải lại server
  version, cảnh báo PostGIS phải được đọc trước khi đóng hoặc tiếp tục đo. Công tác
  mới và measurement được nạp lại vào cây dữ liệu ngay sau khi lưu. Task 8 đã bổ
  sung API/UI lọc đa cấp theo khu vực, lĩnh vực, công tác, mục con, công cụ và
  trạng thái; truy vấn bbox/cursor server-side chỉ tổng hợp dữ liệu đã xác nhận.
  Chọn feature trên bản đồ sẽ highlight/zoom và hiện thẻ chi tiết gọn; dữ liệu
  ngoài vùng nhìn được nạp thêm theo cursor. Task 9 (mở, tải xuống và chỉnh sửa)
  đã bổ sung endpoint lịch sử phép đo, tải GeoJSON đơn/tập lọc có hash và audit;
  export áp dụng filter thực tế. Phiên bản confirmed được chỉnh sửa qua supersede
  có lý do, còn nháp giữ luồng chỉnh sửa trực tiếp.
- Task E2E: Sửa lỗi E2E trên Chromium và WebKit iPad thành công 100% (pass milestone-one.spec.ts). Đã khắc phục lỗi hình học PostGIS cục bộ bằng cách thêm lớp bảo vệ ST_CoveredBy trong truy vấn SQL tính outsideValue, đồng thời cập nhật kịch bản E2E để đồng bộ với UI Drawer/Filter Panel mới và tối ưu hóa việc chuyển đổi viewport bản đồ.
- Dữ liệu Mốc 1–6, nhóm dịch vụ lịch sử và 75 xã/phường phải tiếp tục tương thích
  trong toàn bộ quá trình chuyển đổi.
- Không gian bản đồ tải lớp ranh giới riêng từ 75 xã/phường Sơn La đang hiệu lực
  (67 xã, 8 phường), mỗi mã chỉ lấy phiên bản mới nhất. Lớp chỉ vẽ đường viền trong
  suốt trên nền vệ tinh; 12 khu vực quản lý vẫn chỉ là tên phân loại, không có
  geometry.

## Trạng thái triển khai Mốc 1

- Migration lõi gồm user/session, địa bàn, hồ sơ, nhóm dịch vụ, loại công tác, công
  tác hồ sơ và audit.
- Seed local có 5 nhóm, 15 công tác, một tài khoản giả và một địa bàn fixture có cảnh báo.
- API và UI đã có đăng nhập, danh sách/tạo hồ sơ, xem/tự thêm loại công tác trong
  danh mục và thêm công tác vào hồ sơ.
- Đã có danh mục chính thức 75 xã, phường Sơn La và gói hình học tham khảo có
  checksum/version; chưa có hồ sơ địa giới pháp lý do cơ quan có thẩm quyền bàn giao.
- Local PostGIS đã nhập đủ 75/75, toàn bộ hợp lệ EPSG:4326 và import lặp bỏ qua đủ
  75. Nguồn có một one-point spike tại Mường Bám đã chuẩn hóa có lưu bản gốc/lý do.
  Phiên bản topology mới không còn phần giao trên 0,01 m²; 24 cặp chỉ còn sai số
  floating point tối đa 0,00715 m². Đã ghi 62 thao tác, supersede 75 bản cũ và kiểm
  chứng import lặp. Vẫn phải thay bằng hồ sơ có thẩm quyền khi có.

## Trạng thái triển khai Mốc 2

- Migration phép đo có chỉ mục không gian, phiên bản hiện hành duy nhất, trạng thái
  nháp/cần chú ý/đã xác nhận/đã thay thế và xóa mềm.
- API có tạo, đọc, kiểm tra lại, xác nhận, hiệu chỉnh phiên bản, xóa mềm, tổng hợp
  bản confirmed và ngữ cảnh ranh giới hồ sơ; quyền owner và audit áp dụng cho mutation.
- UI MapLibre có cây lớp nhóm/công tác/phép đo, vẽ điểm–tuyến–vùng, sửa đỉnh,
  undo/redo, kết quả tạm phía trình duyệt, kết quả chính thức phía máy chủ và đổi nền
  không mất lớp nghiệp vụ.
- Bộ integration bao phủ tuyến 1 km, vùng 1 ha, vùng tự cắt, tuyến trùng, tuyến qua
  ranh giới, ba phép đo confirmed và chuỗi supersede. Route-not-found để Mốc 3.

## Trạng thái khắc phục rủi ro ngày 19/07/2026

- Đã đóng lệch runtime: local/CI dùng Node 24.18.0 và pnpm 11.9.0; `pnpm doctor`
  kiểm tra runtime/Docker, `pnpm doctor:services` kiểm tra thêm PostGIS và MinIO.
- Đã tạo baseline Git local Mốc 0–2 tại commit `d183234`; secret scan trước commit
  không phát hiện secret và không có remote/push nào được cấu hình.
- Bundle có cổng CI: main 204,33 kB raw/63,77 kB gzip; map lazy 1.050,43 kB raw/
  278,25 kB gzip; CSS 77,85 kB raw/12,36 kB gzip, đều trong ngân sách ADR-010.
- Đã có provider nền cấu hình, attribution động và fallback Esri. Rủi ro điều khoản
  chỉ được đóng hoàn toàn sau khi người dùng chọn nguồn được cấp phép và giới hạn key.
- Đã có pipeline import địa giới kèm SHA-256, kiểm tra PostGIS và chống ghi đè cùng
  phiên bản. Chưa có ranh giới chính thức; fixture/example vẫn không dùng ngoài test.

## Trạng thái triển khai Mốc 3

- Migration bổ sung cơ sở xử lý và `transport_route` mở rộng measurement route;
  lưu request không token, fingerprint, provider, profile, geometry, legs, thời gian,
  distance, duration, hệ số và kết quả xe.km/tấn.km.
- API có `RoutingProvider`, adapter Mapbox Directions v5 và provider local xác định.
  Backend giới hạn yêu cầu theo phút, chuẩn hóa timeout/quota/no-route/provider error,
  tự gọi provider lại khi lưu và không tin geometry/distance từ trình duyệt.
- Route lưu ở trạng thái confirmed; tính lại tạo measurement/route phiên bản mới và
  chuyển measurement cũ sang superseded trong cùng transaction có audit.
- UI chọn cơ sở xử lý, nhập điểm đầu/waypoint/profile, xem phương án và nguồn cự ly,
  lưu route và yêu cầu lý do khi tính lại.
- Công thức CAL-004/CAL-005 và trường hợp tổng trọng lượng bằng 0 có unit test; API
  integration bao phủ route hợp lệ, nhiều chặng, version và route-not-found.
- Cơ sở xử lý và provider local seed chỉ là fixture kỹ thuật. Trước chạy thật phải
  nhập danh mục chính thức, cấu hình Mapbox token giới hạn API/quota và field-test
  với một tuyến đã biết cự ly.

## Trạng thái triển khai Mốc 4

- PWA có manifest/icon và service worker cache app shell/tài nguyên same-origin;
  loại trừ API và basemap để không cache dữ liệu hoặc nguồn nền trái chính sách.
- Web dùng IndexedDB cho GPS draft và mutation queue, tự thử lại khi online và hiển
  thị `local_only`, `queued`, `syncing`, `synced`, `conflict`, `failed`.
- GPS pause/resume tạo segment riêng; từng raw point lưu tọa độ, timestamp, accuracy,
  altitude/speed nếu có. Normalized geometry lọc theo accuracy version 1 nhưng raw
  geometry/raw point không bị thay thế.
- GPS point ghi một vị trí hiện tại, accuracy và timestamp; kết quả chính thức vẫn
  tính phía server và mutation có cùng bảo vệ idempotency như GPS track.
- Mutation GPS yêu cầu device ID và idempotency key. Backend trả lại kết quả cũ cho
  cùng key/payload, trả conflict cho cùng key khác payload và không tạo measurement trùng.
- Ảnh dùng presigned PUT MinIO; bản ghi pending không phải bằng chứng hoàn tất.
  Backend đọc lại object, kiểm tra size/MIME, tự tính SHA-256, audit rồi mới complete.
- Migration rollback từ chối nếu có GPS point, attachment hoặc sync thành công để
  tránh xóa bằng chứng âm thầm; DB buộc ảnh có đúng một parent và hash/MIME hợp lệ.
- Integration bao phủ raw/normalized GPS, replay/xung đột idempotency, upload hợp
  lệ, MIME/kích thước/hash sai và upload dở. E2E Chromium/WebKit bao phủ phục hồi
  nháp sau reload, pause/resume nhiều segment và queue tự đồng bộ khi online lại.
- Chưa field-test GPS trên thiết bị mục tiêu và chưa kiểm tra CORS presigned PUT với
  cấu hình MinIO/staging thực tế; đây là cổng vận hành còn lại trước production.

## Trạng thái triển khai Mốc 5

- Source quantity lưu loại nguồn, tài liệu, kỳ, đơn vị và attachment đã hoàn tất;
  API không cho nhập sai đơn vị hoặc sửa dữ liệu khi hồ sơ khóa.
- Comparison chỉ cộng measurement confirmed, tính chênh lệch/tỷ lệ phía server,
  kế thừa ngưỡng hồ sơ hoặc ghi đè theo công tác và lưu giải trình riêng có audit.
- Tổng hợp trả theo công tác, nhóm dịch vụ và toàn hồ sơ, tách theo loại nguồn/đơn vị
  để không cộng các đại lượng hoặc nguồn khác bản chất.
- Khóa bắt buộc lý do, tạo SHA-256 snapshot từ ID/phiên bản/kết quả/nguồn/hash bằng
  chứng; mở khóa có lý do và giữ nguyên snapshot/audit cũ.
- Excel có năm sheet Hồ sơ, Công tác, Phép đo, Khối lượng nguồn, Đối chiếu. GeoJSON
  giữ measurement/work item ID và thuộc tính nghiệp vụ; mỗi export lưu hash byte,
  snapshot, actor, thời gian, bộ lọc và audit. Export chỉ chạy khi hồ sơ đã khóa;
  khóa cũng chặn bắt đầu/hoàn tất attachment để giữ dataset bất biến.
- XLSX đang tạo trong bộ nhớ phù hợp giới hạn MVP; export 10.000 dòng và thay provider
  bằng streaming/queue cần được kiểm tra trong Mốc 6 trước production.

## Trạng thái triển khai Mốc 6

- API có security headers, `no-store`, HSTS khi secure transport và login rate limit
  cấu hình được. Integration test kiểm IDOR bằng hai owner và gọi API trực tiếp.
- Benchmark riêng tạo/đọc 10.000 geometry và tạo XLSX trong ngân sách phát hành;
  unit suite không phụ thuộc database hoặc benchmark thời gian.
- Script backup tạo PostgreSQL custom dump, mirror bucket và SHA-256 manifest.
  Restore drill local đã phục hồi database/PostGIS và bucket tạm rồi dọn an toàn.
- CI chạy performance và backup/restore ngoài các cổng lint/type/integration/E2E/audit.
- Đã có hướng dẫn người dùng, runbook, checklist production, protocol field test và
  backlog giai đoạn 2.
- Chưa được phép đánh dấu production-ready: field test thiết bị/iPad, route/GPS thật,
  restore staging, địa giới/cơ sở xử lý chính thức và key provider giới hạn chưa có
  bằng chứng nghiệm thu trong repository.

## Trạng thái backlog P1 giai đoạn 2

- Đã triển khai sao chép chọn lọc cấu trúc công tác ngay trong luồng tạo hồ sơ.
  Snapshot công thức, đơn vị và ngưỡng được giữ; công tác đích về `draft` và bỏ kỳ cũ.
- Transaction kiểm quyền owner và rollback toàn bộ khi hồ sơ/công tác mẫu không hợp
  lệ. Audit ghi liên kết nguồn/đích; phép đo, route/GPS, ảnh, nguồn, comparison và
  audit cũ không được nhân bản.
- Integration bao phủ sao chép chọn lọc, không mang phép đo và rollback; E2E bao phủ
  chọn hồ sơ mẫu/công tác trên Chromium và WebKit iPad.
- Các P1 còn lại (import preview/schema, phục hồi xóa mềm/conflict UI, bbox/pagination,
  queued export và malware/thumbnail lifecycle) đã được triển khai theo ADR-021.
- GeoJSON import giới hạn 5 MB/1.000 feature, phát hiện schema, kiểm hash preview và
  commit nguyên transaction; batch cùng từng phép đo đều có audit.
- Danh sách hồ sơ/phép đo dùng cursor ổn định; phép đo nhận bbox EPSG:4326. UI nạp
  trang 200 bản ghi, dùng `content-visibility` và có thao tác nạp tiếp.
- Hồ sơ, phép đo và ảnh có danh sách xóa mềm/phục hồi kèm lý do, owner/lock check và
  audit. Lỗi API hiển thị mã, trace ID và nút nạp lại dữ liệu.
- Export UI dùng job pending/processing/completed/failed, artifact lưu MinIO và tải
  qua API có kiểm quyền. Job pending được nhận lại khi API restart; processing quá
  15 phút được trả về hàng đợi.
- Ảnh mới fail-closed nếu ClamAV lỗi, chỉ completed khi scan clean; Sharp tạo WebP
  tối đa 480 px. MinIO local bật versioning, chỉ `exports/` hết hạn sau 90 ngày;
  evidence và thumbnail không có lifecycle xóa tự động.
- Local đã xác minh ClamAV 1.4.5 bằng EICAR và dữ liệu sạch. Node 24.18.0 được cài ở
  phạm vi người dùng; `pnpm doctor:services` kiểm thêm ClamAV.

## Trạng thái khả dụng local ngày 19/07/2026

- Đã sửa luồng tạo hồ sơ để người dùng nhập kỳ trước; danh sách địa bàn chỉ hiện
  phiên bản có thời hạn hiệu lực giao với kỳ hồ sơ và hiển thị rõ ngày hiệu lực.
- Đã phát hiện bộ integration/E2E trước đây dùng chung `dove_field`, làm lẫn fixture
  vào tài khoản owner. Sau khi backup PostgreSQL + MinIO có checksum, 282 hồ sơ được
  chuyển sang tài khoản fixture vô hiệu hóa, 78 loại công tác E2E ngừng kích hoạt và
  24 địa bàn integration kết thúc hiệu lực. Không xóa cứng hồ sơ hoặc bằng chứng;
  mỗi thay đổi có audit `test_fixture_quarantined`.
- Integration, performance và E2E nay dùng `dove_field_test`; API E2E dùng cổng 3100
  để không tái sử dụng nhầm API local cổng 3000. Không gian owner local trở về trạng
  thái sạch để tạo hồ sơ thật từ 75 xã/phường Sơn La đang có hiệu lực.
- Bản đồ hiện trường luôn mở được ngay cả khi hồ sơ chưa có công tác để người dùng
  xem ranh giới và nền bản đồ. Cây lớp và panel thuộc tính hướng dẫn quay lại thêm
  công tác trước khi đo; nút bản đồ không còn bị ẩn gây nhầm là chưa có chức năng.
- Đã bổ sung nền `Vệ tinh Mapbox` qua raster Satellite Streets trong
  `BasemapProvider`. Public token chỉ được đọc từ `.env.local`, attribution được giữ
  trên bản đồ; Esri **Vệ tinh + địa danh** là fallback hiển thị khi token/tiles không khả dụng.
- Đã bổ sung adapter Google Map Tiles phía API cho nền vệ tinh kèm nhãn đường/địa
  danh tiếng Việt. Khóa Google không vào bundle PWA; tile và attribution viewport
  đi qua route same-origin có auth, `no-store` và tắt access log tọa độ. Nền chỉ
  xuất hiện khi `GOOGLE_MAP_TILES_API_KEY` được cấp qua `.env.local`/secret manager;
  chưa nghiệm thu tile thật vì repository không chứa khóa Google có billing.
- Sau khi người dùng sửa nguồn tham chiếu sang màn hình La Kinh Vệ Tinh của `Minh
  Huyen`, đã đối chiếu cơ chế Mapbox `satellite-streets-v12` + Google raster chèn
  dưới label. Ứng dụng áp dụng phần Mapbox được cấp phép và đặt `Vệ tinh Mapbox +
  địa danh` làm mặc định khi public token tồn tại; không sao chép `mt1.google.com`.
  Esri World Imagery + reference layers vẫn là fallback không cần key.
- Chủ dự án sau đó chấp thuận thay đổi quy tắc để dùng `mt1.google.com`. Adapter
  thêm nền mặc định `Google vệ tinh + địa danh` bằng `lyrs=y&hl=vi`; component không
  gọi trực tiếp, service worker không cache và Google chính thức/Mapbox/Esri/local
  vẫn được giữ làm fallback. Endpoint đã trả tile Sơn La nhưng chưa có bảo đảm API
  hoặc nghiệm thu điều khoản cho production.
- Nền có public token Mapbox được tách thành ảnh Google `lyrs=s` và nhãn vector
  Mapbox. Tất cả symbol label căn theo `viewport`, nên giữ hướng nằm ngang khi người
  dùng xoay/nghiêng bản đồ; Google hybrid raster là fallback nếu lớp nhãn lỗi.
- Không gian bản đồ không còn panel trống bên phải hoặc thanh trạng thái phủ đáy.
  Điểm/Tuyến/Vùng tự dùng công tác tương thích hoặc mở form tạo nhanh; chi tiết phép
  đo chuyển thành ngăn đóng/mở và tự mở khi cần lưu kết quả.
- Khi vẽ tuyến hoặc vùng, bản đồ hiển thị tổng chiều dài/diện tích tạm tính trong
  nhãn gọn, bán trong suốt ngay dưới thanh công cụ và cập nhật sau từng điểm. Kết quả
  máy chủ sau khi lưu vẫn là số liệu chính thức.
- Thanh Điểm/Tuyến/Vùng nay luôn mở bước chọn công tác có sẵn để bổ sung thêm
  đoạn/vùng/bộ phận vào cùng một công tác. Cây lớp hiển thị tổng đã xác nhận của
  công tác và số liệu riêng từng phép đo để người dùng thấy rõ phần nào được cộng.
- Draft vẽ bản đồ hoàn toàn ẩn các điểm chọn (đỉnh nháp) để tránh gây rối và mất thẩm mỹ, loại bỏ hoàn toàn marker chữ thập đỏ và vòng tròn viền đỏ lớn chói mắt. Chỉ hiển thị nét vẽ nháp và đổi nút hoàn tác thành **Lùi điểm/Khôi phục điểm** trong lúc đang vẽ.
  Form lưu phép đo hiển thị nhãn tiếng Việt và mô tả cho các biến công thức phổ biến
  như `side_factor`, `frequency` và `service_days`.
- Theo yêu cầu ngày 20/07/2026, hai style **Kỹ thuật sáng/tối · kiểm thử** đã được
  bỏ khỏi combobox người dùng. Style local chỉ còn phục vụ kiểm thử tự động; lỗi
  nền hiển thị chuyển sang Esri **Vệ tinh + địa danh** thay vì nền màu trống.
- Luồng nhập nhanh Ưu tiên 1 dùng thẻ **Công tác đang đo** được ghi nhớ theo hồ sơ
  trong phiên trình duyệt. Loại công tác quyết định trực tiếp thao tác điểm/tuyến/
  vùng/route; không còn bước chọn lại kiểu hình học và công tác cho mỗi phép đo.
- Phiếu lưu tự sinh tên bộ phận, kế thừa đầu vào công thức hợp lệ gần nhất và hỗ trợ
  **Lưu và tiếp tục** hoặc **Lưu và xác nhận**. Mọi cảnh báo đều chặn xác nhận nhanh,
  giữ phép đo ở trạng thái nháp để bảo toàn bước rà soát và audit máy chủ.
- Luồng nhập nhanh Ưu tiên 2 thêm hàng đợi **Cần rà soát** theo công tác ngay trong
  bản đồ. Nháp không có cảnh báo được xác nhận một chạm và tải lại tổng máy chủ;
  phép đo có cảnh báo chỉ mở chi tiết, không tự xác nhận hay tự cộng.
- Luồng nhập nhanh Ưu tiên 3 thêm **Tiến độ hồ sơ** và điều hướng **Đến việc cần
  làm**. Tiến độ chỉ nêu số công tác có dữ liệu, bộ phận confirmed và mục cần xử lý;
  không tự gán trạng thái hoàn thành vì danh mục không có chỉ tiêu số lượng bắt buộc.
- Lớp địa giới 75 xã/phường dùng nét đứt đỏ, tăng độ đậm theo zoom. API trả thêm
  `ST_PointOnSurface` của từng địa giới để đặt tên viết hoa, đứng, đậm bên trong
  hình xã; cỡ chữ và chiều rộng nhãn tự điều chỉnh theo mức zoom, độc lập với hướng
  xoay của nền bản đồ.
- Nền bản đồ mặc định được cấu hình sang **Vệ tinh + địa danh (`esri-imagery-labels`)**, hoạt động ổn định 100% không phụ thuộc API key ngoài, loại bỏ hoàn toàn thông báo chuyển nền tự động.
- Ngăn chi tiết được tinh gọn hoàn toàn theo yêu cầu người dùng: loại bỏ mục Khối lượng, Trạng thái, Quy tắc công thức, Cảnh báo hồng và các mục GPS track; chỉ tập trung hiển thị Nội dung công việc, Thời gian lập, Giá trị (m, m²), Ảnh hiện trường và nút Xóa / Tải GeoJSON.
- Kích chọn đối tượng đã lưu trên bản đồ sẽ hiển thị thẻ thông tin `.map-feature-card` gồm tên phép đo, loại hình học (Tuyến/Vùng/Điểm), chiều dài/diện tích và nút **"Sửa phép đo"**.
- Chế độ sửa (`mode === 'edit'`) hỗ trợ hiển thị các nút ghim trung điểm `(+)` `.map-midpoint-handle` giữa các đỉnh. Nhấp hoặc kéo nút `(+)` sẽ **tách đôi đoạn thẳng** và chèn thêm đỉnh mới vào giữa thời gian thực.
- Thanh công cụ bản đồ được thống nhất thành 1 thanh ngang nổi duy nhất phía trên màn hình (`.map-toolbar-container`), tích hợp toàn bộ các nút công cụ đo (Điểm, Chiều dài, Diện tích), thao tác đo (Lùi, Tiến, Xóa, Kết thúc) và mở bảng điều khiển (Dữ liệu, Bộ lọc, Nâng cao).
- Biểu tượng logo công cụ được cập nhật chuẩn xác: Chiều dài dùng biểu tượng **Thước kẻ thẳng chia vạch (Ruler)**, Diện tích dùng **Thước Ê-ke góc vuông (Set-square / Triangle Ruler)**, Điểm dùng **Ghim tâm (Location pin marker)**.
- Bổ sung tính năng kéo/di chuyển đỉnh (Node/Vertex Dragging): Các đỉnh của tuyến và vùng hiển thị các ghim điều khiển `.map-node-handle` và `.map-node-handle--draft`, cho phép người dùng bấm giữ và kéo trực tiếp các đỉnh để điều chỉnh tọa độ và tính toán lại chiều dài/diện tích thời gian thực khi vẽ nháp hoặc khi sửa phép đo.
- Rà soát giao diện quản lý số liệu ngày 22/07/2026: bản đồ mở ở trạng thái sạch,
  không tự bung drawer. Nút **Quản lý số liệu** mở danh sách gọn theo Điểm/Chiều
  dài/Diện tích; phần quản lý công tác được thu gọn mặc định. Thẻ đối tượng trên
  bản đồ có thao tác **Sửa hình dạng**, **Thông tin** và **Xóa** có xác nhận. Chế độ
  sửa yêu cầu lý do và lưu thành phiên bản mới; nút thùng rác trên toolbar không
  còn xóa trực tiếp một phép đo đã lưu.
- Thanh **Quản lý số liệu** được tách khỏi toolbar đo và đặt thành rail đứng sát
  cạnh trái bản đồ. Rail luôn gọn, mở drawer dữ liệu sang phải và bám vào mép drawer
  để người dùng bấm thu gọn/ẩn lại mà không phải di chuyển con trỏ về toolbar trên.
- Chốt lại kích thước ngăn **Quản lý số liệu** theo phản hồi trực quan: đây là
  sidebar toàn chiều cao, không phải bottom sheet; rộng khoảng 1/7 giao diện máy
  tính và 1/3 giao diện điện thoại. Các drawer chi tiết/nâng cao khác không đổi.
- Nút mở **Quản lý số liệu** được thu về một ô vuông biểu tượng ba gạch, không có
  chữ/mũi tên và nằm giữa cạnh trái; khi drawer mở, nút bám giữa cạnh phải của
  drawer. Thanh công cụ phía trên giảm chiều cao, khoảng đệm và tự co nút theo
  viewport để mọi công cụ luôn hiện đủ trong một hàng, không cuộn ngang.
- Biểu tượng mở **Quản lý số liệu** tiếp tục được tinh gọn theo phản hồi trực quan:
  vùng điều khiển 32 px, biểu tượng ba gạch 17 px và nền/viền/bóng hoàn toàn trong
  suốt ở cả trạng thái thường lẫn trạng thái mở.
- Cụm tab Điểm/Chiều dài/Diện tích trong sidebar hẹp được chia thành ba cột
  `minmax(0, 1fr)`, hiển thị biểu tượng trên và số lượng dưới. Header và khoảng đệm
  riêng của drawer trái cũng được nén để cả ba biểu tượng luôn nằm trọn trong ngăn,
  không sinh cuộn ngang.
- Chức năng **Bộ lọc** trên bản đồ được chuyển thành **Tìm kiếm** với biểu tượng
  kính lúp. Giao diện chính chỉ còn ô tìm theo tên và một danh mục gộp Khu vực/
  Lĩnh vực/Công tác; API tìm chuỗi không phân biệt hoa thường trên tên phép đo,
  công tác, mục con, lĩnh vực và khu vực. Tìm kiếm chỉ chạy khi người dùng bấm nút
  **Tìm kiếm**; phần **Tùy chọn nâng cao** và các tiêu chí cũ đã được bỏ khỏi UI.
- Theo xác nhận ngày 22/07/2026, dashboard và quản lý hồ sơ không còn nằm trong
  luồng sử dụng thông thường. Sau đăng nhập ứng dụng mở thẳng bản đồ; khi chưa có
  hồ sơ hoạt động, hệ thống tự tạo một không gian nội bộ trống để giữ liên kết dữ
  liệu, version và audit ở backend. Hồ sơ mẫu local “Vân Hồ” đã được xóa mềm qua
  API; không xóa cứng dữ liệu hay lịch sử chứng cứ.
- Thông báo lỗi bản đồ được chuyển thành toast gọn ở góc dưới, có nút đóng và
  không còn phủ lên thanh công cụ đo/tìm kiếm ở cạnh trên.
- Quy trình nhập liệu mặc định ngày 22/07/2026 dùng nền **Google vệ tinh + Địa danh
  & Cửa hàng**. Sau khi kết thúc Điểm/Chiều dài/Diện tích, phiếu lưu nhỏ chỉ hỏi tên
  công tác, một trong 12 khu vực quản lý cũ và hiển thị số liệu sát đơn vị `m`/`m²`;
  một nút **Lưu** tự thực hiện lưu nháp và phân loại ở lớp nội bộ để vẫn giữ audit.
- Ngăn mở từ nút **Thông tin** được đổi thành drawer nổi gọn, font nhỏ và chỉ còn
  tên, thời gian lập, số liệu cùng ảnh hiện trường. Người dùng có thể chọn ảnh có
  sẵn hoặc gọi camera sau; GPS, GeoJSON, xóa và các accordion nâng cao không còn
  xuất hiện trong ngăn này.
- Tương tác thẻ đối tượng ngày 22/07/2026 dùng cập nhật lạc quan: đổi màu nét, sửa
  tên/khu vực/dịch vụ và xóa mềm phản ánh ngay trên bản đồ cùng ngăn **Dữ liệu**,
  sau đó đồng bộ máy chủ và tự hoàn nguyên khi lỗi. Đổi dịch vụ chỉ cho phép loại
  công tác có cùng kiểu hình học, đồng thời cập nhật snapshot công thức và audit.
- Nút ba gạch **Quản lý số liệu** được chuyển từ rail cạnh trái vào cụm điều khiển
  trên thanh công cụ bản đồ; drawer dữ liệu vẫn giữ chiều rộng gọn 1/7 desktop và
  khoảng 1/3 mobile.
- Nguồn dữ liệu ngày 22/07/2026 được tách theo mục đích: lớp bản đồ tiếp tục truy
  vấn theo `bbox` để giữ hiệu năng, còn drawer **Quản lý số liệu** tải toàn bộ phép
  đo đang hoạt động của hồ sơ bằng phân trang độc lập. Tạo/sửa/đổi màu/xóa mềm cập
  nhật lạc quan đồng thời cả hai nguồn, nên danh sách không phụ thuộc vùng bản đồ.
- Thanh công cụ bản đồ hỗ trợ phím tắt: `P` vẽ điểm, `D` vẽ chiều dài, `A` vẽ diện
  tích, `Delete`/`Backspace` xóa đỉnh đang chọn, `Cmd/Ctrl+Z` lùi thao tác và
  `Cmd/Ctrl+S` lưu/kết thúc khi hình học đã đủ điểm. Phím tắt không chạy khi con
  trỏ đang ở ô nhập, danh sách chọn hoặc vùng soạn thảo.
- Header bản đồ được nén còn 48–52 px và bỏ hoàn toàn tiêu đề hồ sơ “Dữ liệu hiện
  trường”. Nhãn lớp hành chính rút thành **RG & tên P/X**; bộ chọn bản đồ nền chỉ
  còn biểu tượng lớp bản đồ 40 px, nhưng vẫn giữ menu chọn đầy đủ và nhãn trợ năng.
- Phiếu lưu nhanh có nút **Hủy** riêng. Hủy, đóng bằng nút × hoặc phím Escape đều
  gọi chung luồng xóa hình học chưa lưu, đặt bản đồ về chế độ xem và không để lại
  nét nháp không có ID khiến người dùng nhìn thấy nhưng không thể thao tác.
- Lệnh khởi động local tách ba dịch vụ dài hạn (`postgis`, `minio`, `clamav`) khỏi
  job một lần `minio-init`. Compose chỉ chờ healthcheck của dịch vụ dài hạn, sau đó
  chạy job tạo bucket, tránh hiểu trạng thái `Exited (0)` hợp lệ là lỗi khiến API và
  web không khởi động, tab PWA cũ vẫn hiện nhưng đăng nhập/bản đồ không phản hồi.
- Nét đang vẽ dùng hai lớp tương phản: viền trắng 7 px dưới nét cam đặc 4 px. Tuyến
  và viền vùng nháp vì vậy vẫn nhìn rõ trên ảnh vệ tinh, đường địa danh và ranh giới
  hành chính màu đỏ, trong khi không tăng số lượng marker điều khiển trên màn hình.
- Thẻ đối tượng ngày 22/07/2026 bỏ nút **Thông tin**, hiển thị **Ngày lập** trực
  tiếp và không còn ghi khu vực phân loại thành **Địa chỉ**. Mười hai khu vực quản
  lý không có geometry theo ADR-024 nên không đủ cơ sở xác minh địa chỉ tại tọa độ;
  trường này chỉ còn nhãn đúng nghĩa **Khu vực** trong biểu mẫu chỉnh sửa. Chọn một
  dòng trong **Quản lý số liệu** chỉ chọn đối tượng và mở thẻ gọn, không tự bung
  drawer **Thông tin** cũ.
- Thẻ đối tượng bổ sung dòng **Khu vực** và nút **Thêm**. Nút này dùng quan hệ một
  công tác–nhiều phép đo sẵn có để vẽ thêm Điểm/Chiều dài/Diện tích trong cùng công
  tác, giữ từng geometry và audit độc lập. Chọn tên trong **Quản lý số liệu** đưa
  MapLibre tới geometry lấy từ inventory toàn hồ sơ, nên hoạt động cả khi đối tượng
  nằm ngoài bbox hiện tại; mỗi lần bấm đều phát sinh yêu cầu định vị mới.
- Nền mặc định ưu tiên **Google vệ tinh · nhãn dễ đọc** khi có Mapbox public token
  hợp lệ; nếu thiếu token thì dùng nền Google vệ tinh có địa danh/cửa hàng làm
  fallback. Luồng **Thêm** dùng drawer compact chỉ gồm số liệu phần bổ sung, tên và
  nút **Lưu**. Thẻ đối tượng cộng các phép đo còn hiệu lực thành **Tổng số liệu** và
  liệt kê từng phép đo bên dưới; geometry và audit của từng lần vẫn độc lập.
- Nhãn thành phần trên thẻ được chuẩn hóa theo geometry và thứ tự:
  **Điểm/Tuyến/Vùng 01, 02…**, không lặp lại tên đầy đủ của đối tượng. Thẻ chuyển
  sang góc phải, giảm typography/kích thước và hỗ trợ đóng bằng **Esc** hoặc nhấp ra
  ngoài bên cạnh nút ×.
- Drawer **Quản lý số liệu** trên desktop dùng chiều rộng khoảng 22,86% viewport
  (tăng xấp xỉ 60% so với 1/7 trước đây, có giới hạn 320–440 px); trên mobile vẫn
  giữ 1/3 viewport. Danh sách chỉ hiển thị một đối tượng chính cho mỗi công tác,
  số liệu tổng ở dòng chính và phần đo bổ sung thu gọn bên dưới để không tạo các
  đối tượng độc lập trùng lặp. Thẻ danh sách được giảm cỡ chữ, chiều cao và đệm dọc.
- Thẻ Popover rà chuột (`MapHoverPopover`) được nén gọn 2 dòng: dòng 1 là tên đối tượng, dòng 2 hiển thị đơn vị + số liệu (`Chiều dài: ... m`, `Diện tích: ... ha/m²`, `Số điểm: ... điểm`). Đơn vị chiều dài chuẩn hóa hiển thị `m` (bỏ chữ `lần`). Khung background trong suốt kính mờ glassmorphism (58% opacity + backdrop blur).
- Khi kích chọn một thành phần đo (trên bản đồ hoặc danh sách), toàn bộ các thành phần trong cùng nhóm đối tượng (`workItemId`) đồng thời được hiển thị nổi bật trên bản đồ (tăng nét & viền màu cam), giúp quan sát trọn vẹn hình học công tác; thành phần cụ thể được kích vào vẫn duy trì điểm nhấn riêng và xem chi tiết độc lập.
- Chế độ Kính lúp điểm chấm 2x (`TouchMagnifierGlass`) cho iPad/điện thoại: khi chạm giữ hoặc di ngón tay để số hóa mốc góc (`point`, `line`, `area`, `measure`), một vòng kính lúp tròn (đường kính 140px) hiển thị cao hơn đầu ngón tay 148px với độ phóng đại 2x và tâm ngắm chữ thập (+) phản quang, giúp kỹ sư chấm mốc chính xác từng giao điểm mà không bị ngón tay che khuất.
- Mục **Quản lý số liệu** tóm gọn mặc định theo từng khu vực: các accordion khu vực (`Phường Chiềng Lề`, `Phường Tô Hiệu`,...) thu gọn mặc định khi mở drawer, chỉ hiển thị số lượng đối tượng tổng quan; khi nhấn vào khu vực nào mới mở danh sách đối tượng tương ứng (hoặc tự động mở khu vực chứa đối tượng đang được chọn).
- Luồng **Tìm kiếm đối tượng**: Sau khi xem xong đối tượng tìm được, người dùng chỉ cần nhấn phím **Esc** hoặc **nhấp chuột ra vùng trống bên ngoài đối tượng trên bản đồ** để xóa chọn, hủy bộ lọc tìm kiếm và lập tức thoát khỏi chế độ tìm kiếm về giao diện bản đồ bình thường.
- Chế độ **Chói nắng Thực địa & Ban đêm** (`fieldMode: 'normal' | 'sun' | 'night'`): Tích hợp cụm nút chuyển đổi 3 trạng thái (🌐 Chuẩn, ☀️ Chói nắng, 🌙 Đêm) trên header bản đồ. Chế độ **Chói nắng** áp dụng bộ màu Neon phản quang tương phản siêu cao (`#00ff66` Lime, `#00ffff` Cyan, `#ffff00` Yellow, `#ff00ff` Magenta), tăng độ dày nét vẽ để quan sát siêu rõ dưới ánh nắng mặt trời gắt; Chế độ **Ban đêm** áp dụng lớp lọc dịu mắt và dải màu Dạ quang (`#34d399` Emerald Glow, `#38bdf8` Soft Cyan) hỗ trợ tốt cho ca trực đêm.
- Chuẩn hóa **Đơn vị tính & Chu vi đối tượng diện tích**: Hàm `sanitizeUnit` tự động loại bỏ hoàn toàn các hậu tố `.lần` hoặc `lần` ở mọi vị trí hiển thị (thẻ Popover, nhãn vector trên bản đồ, thẻ đối tượng và chi tiết phép đo), đưa đơn vị về đúng chuẩn (`m²`, `ha`, `m`, `điểm`). Đối với các đối tượng diện tích (`geometryKind: 'area'` hoặc `Polygon`), hệ thống bổ sung số liệu **Chu vi (đơn vị m)** được tính tự động từ hình học GeoJSON chính thức thông qua hàm `polygonPerimeterMeters`.
- Phím **Esc thoát nhanh lệnh đo & Gióng đường nét đứt vuông góc**: Khi đang ở bất kỳ công cụ đo đạc nào (`point`, `line`, `area`, `measure`), nhấn phím **Esc** lập tức hủy các điểm nháp và thoát nhanh về chế độ xem bản đồ bình thường. Trong quá trình chấm mốc đo, hệ thống hiển thị đường nối mờ (nét đứt mảnh [3, 3]) từ điểm vừa chấm đến con trỏ; khi góc tiệm cận 90° so với đoạn thẳng trước đó (ngưỡng 14px), con trỏ tự động bắt dính vuông góc chuẩn xác, đường gióng đổi sang màu **Xanh Neon (`#00ff66`)** đồng thời hiển thị **ký hiệu vuông góc ∟** tại đỉnh góc.
- **Bắt điểm Giao vuông góc giữa 2 điểm tham chiếu (Object Snap Tracking - OTRACK)**: Khi kỹ sư đang thực hiện đo đạc và rê chuột qua 2 điểm mốc khác (hoặc 1 điểm đã chấm + 1 điểm góc mốc bất kỳ trên bản đồ), 2 điểm này được gắn vòng tròn mục tiêu **Cyan Neon (`#00ffff`)**. Khi di chuyển con trỏ tiệm cận vùng giao điểm chiếu vuông góc của 2 điểm đó (ngưỡng 20px), con trỏ tự động **bắt dính chuẩn xác vào tọa độ giao điểm vuông góc**, tự động bắn 2 đường gióng nét đứt mờ song song/vuông góc từ 2 điểm mốc đến giao điểm, hiển thị biểu tượng **góc vuông ∟** và nhãn tooltip `🎯 Giao điểm vuông góc (90°)`.
- **4 Cải tiến Trải nghiệm Thao tác Đo đạc (Ortho Lock, Quick Rect 2-Click, Magnifier Toggle, Reverse Line Direction)**:
  1. **Khóa hướng Ortho (`📐` / `Shift`)**: Khi vẽ tuyến/vùng/đo nháp, giữ phím `Shift` hoặc bật nút `📐 Ortho` trên thanh công cụ sẽ khóa tuyệt đối hướng di chuyển con trỏ theo trục ngang ($0^\circ$) hoặc dọc ($90^\circ$) từ điểm trước đó.
  2. **Vẽ hình chữ nhật Quick Rect (`⏹️` / `R`)**: Công cụ vẽ hình chữ nhật 2 nhấp (Click 1: Đỉnh góc 1, Click 2: Đỉnh góc đối diện), tự động dựng hình chữ nhật 4 đỉnh vuông góc chuẩn xấp xỉ diện tích thực địa.
  3. **Nút bật/tắt Kính lúp (`🔍 Magnifier`)**: Nút bật/tắt nhanh chế độ kính lúp phóng đại 2x trên thanh công cụ `DrawingToolbar`, hỗ trợ thao tác soi kính lúp trên PC/Desktop mà không cần thao tác vuốt cảm ứng.
  4. **Đảo chiều Tuyến đo (`🔄 Đảo chiều`)**: Nút 1-click trong bảng chi tiết tuyến đo `MeasurementInspector` hỗ trợ đảo ngược mảng tọa độ tuyến (`coordinates.reverse()`) và lưu thành bản ghi hiệu chỉnh mới (`supersedeMeasurement`), giúp xử lý chuẩn xác hướng di chuyển công ích.
- **Loại bỏ công cụ Đo nháp khỏi thanh công cụ (`DrawingToolbar`)**: Theo yêu cầu đơn giản hóa giao diện sử dụng thực địa, nút **Đo nháp** (`measure`) đã được loại bỏ khỏi danh sách công cụ đo nhanh trên thanh `DrawingToolbar`, tập trung giao diện chính cho 4 công cụ số hóa chính (`Điểm`, `Chiều dài`, `Diện tích`, `Hình chữ nhật`) cùng các tiện ích hỗ trợ (`🧲 Bắt điểm`, `📐 Ortho`, `🔍 Kính lúp`).
