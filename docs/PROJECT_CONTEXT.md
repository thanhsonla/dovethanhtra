# PROJECT_CONTEXT

## Trạng thái

- Phiên bản tài liệu: 1.1.
- Ngày chốt phạm vi: 18/07/2026.
- Giai đoạn: Mốc 6 — hardening, benchmark, backup/restore local và tài liệu vận hành
  đã triển khai; field test thiết bị và restore staging còn là cổng trước production.
- Người dùng chính: một cán bộ thực hiện kiểm tra hiện trường; kiến trúc vẫn chuẩn bị cho nhiều người dùng về sau.

## Quyết định đã chốt

- Hình thức: web/PWA responsive cho máy tính, iPad và điện thoại.
- Công cụ hiển thị: MapLibre GL JS.
- Cơ sở dữ liệu: PostgreSQL + PostGIS.
- Định tuyến ban đầu: Mapbox Directions qua adapter.
- Không dùng trực tiếp tile `mt1.google.com`.
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
- Mốc 2 dùng hai nền kỹ thuật local qua `BasemapProvider`, không cần khóa API và
  không gọi tile bên thứ ba.
- Basemap được cấp phép có thể cấu hình bằng HTTPS style URL + attribution; lỗi tải
  style chuyển về nền local. Không có nhà cung cấp thật hoặc token nào được commit.
- Import địa giới yêu cầu FeatureCollection EPSG:4326, nguồn/phiên bản/ngày hiệu lực,
  lưu SHA-256 byte nguồn và từ chối ghi đè cùng phiên bản nếu hash thay đổi.
- Danh mục 75 xã, phường Sơn La dùng Nghị quyết 1681/NQ-UBTVQH15 và Quyết định
  19/2025/QĐ-TTg. Hình học snapshot 11/03/2026 là dữ liệu tham khảo MIT, không thay
  hồ sơ địa giới pháp lý; phiên bản nhập được chốt tại ADR-018.
- ADR-019 chuẩn hóa topology theo diện tích mục tiêu 01/07/2026: xử lý phần giao lớn
  nhất trước, chọn bên giữ để giảm sai lệch diện tích và giữ nguyên hợp geometry.
  Ngưỡng floating point là 0,01 m²; bản gốc không bị ghi đè.

## Chưa chốt

- Nhà cung cấp hosting chính thức.
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
- Đã có provider nền cấu hình, attribution động và fallback local. Rủi ro điều khoản
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
