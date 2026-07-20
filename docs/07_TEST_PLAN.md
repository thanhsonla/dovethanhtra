# 07. Kế hoạch kiểm thử và tiêu chí phát hành

## 1. Mục tiêu

Kiểm thử tập trung vào bốn rủi ro: tính sai khối lượng, mất/nhân đôi dữ liệu, sửa dữ liệu không truy vết và phụ thuộc nhà cung cấp bản đồ/định tuyến.

## 2. Tầng kiểm thử

### Unit test

Áp dụng cho công thức, làm tròn, chuyển đổi đơn vị, trạng thái, validation schema, idempotency và mapping provider response.

### Integration test

Áp dụng cho API + PostgreSQL/PostGIS, transaction, permission, upload completion, route adapter và export.

### E2E

Áp dụng cho luồng người dùng trên Chrome desktop và Safari/WebKit kích thước iPad.

### Field test

Thử tại một khu vực đã biết chiều dài/diện tích và một tuyến vận chuyển thực tế; so sánh bản đồ, route và GPS.

## 3. Bộ dữ liệu chuẩn

- Hồ sơ mẫu “Mộc Châu — kiểm tra thử 2025”.
- Một boundary hợp lệ và một boundary có thay đổi phiên bản.
- Tuyến chuẩn xấp xỉ 1.000 m.
- Polygon chuẩn xấp xỉ 10.000 m².
- Polygon tự cắt.
- Hai tuyến trùng một phần và hai vùng chồng lặp.
- Một geometry nằm một phần ngoài boundary.
- Route có điểm đầu/cuối hợp lệ; route không tìm được đường.
- GPS track bình thường; track có điểm nhảy; track có khoảng thời gian gián đoạn.
- Ảnh hợp lệ, tệp quá lớn, MIME giả và hai tệp giống hash.

## 4. Ca kiểm thử chức năng cốt lõi

| Mã        | Nội dung                      | Kết quả mong đợi                       |
| --------- | ----------------------------- | -------------------------------------- |
| CASE-001  | Tạo hồ sơ đủ trường           | Hồ sơ nháp, boundary snapshot được lưu |
| CASE-002  | periodEnd trước periodStart   | Từ chối với lỗi rõ ràng                |
| CASE-003  | Sửa hồ sơ đã khóa qua API     | Bị từ chối và có log an toàn           |
| CAT-001   | Tạo công tác line             | Schema và công thức phiên bản hóa      |
| CAT-002   | Ngừng loại công tác đang dùng | Hồ sơ cũ vẫn đọc được                  |
| CAT-003   | Đổi tên công tác/mục con       | ID/liên kết giữ nguyên, có audit       |
| CAT-004   | Xóa cha còn con hoạt động      | Từ chối, không cascade dữ liệu         |
| MEAS-001  | Đo tuyến chuẩn                | Kết quả máy chủ trong dung sai         |
| MEAS-002  | Đo polygon chuẩn              | Kết quả máy chủ trong dung sai         |
| MEAS-003  | Lưu polygon tự cắt            | Không cho xác nhận; trả warning/error  |
| MEAS-004  | Ba phép đo một công tác       | Tổng chỉ gồm bản confirmed             |
| MEAS-005  | Sửa phép đo confirmed         | Tạo version mới; bản cũ superseded     |
| MEAS-006  | Geometry ngoài boundary       | Cảnh báo kèm phần ngoài ranh giới      |
| MEAS-007  | Lưu hình trước khi phân loại  | Tạo nháp, không cộng tổng              |
| MEAS-008  | Phân loại nháp vào mục con    | Tạo measurement và audit một lần       |
| MEAS-009  | Ba đoạn trong một mục con     | Tổng mục con/công tác chỉ gồm confirmed |
| MEAS-010  | Gửi lại classify cùng key     | Trả kết quả cũ, không nhân đôi         |
| ROUTE-001 | Tính route hợp lệ             | Lưu distance, geometry, provider, time |
| ROUTE-002 | Tính lại route                | Tạo version, không ghi đè              |
| ROUTE-003 | Không tìm được route          | Lỗi xử lý được, không tạo bản ghi rỗng |
| ROUTE-004 | Route vượt giới hạn waypoint  | Chia chặng/hướng dẫn người dùng        |
| COMP-001  | Nguồn 100, kiểm tra 90        | -10 và -10%                            |
| COMP-002  | Nguồn bằng 0                  | Không chia 0; cảnh báo phù hợp         |
| EVID-001  | Tải ảnh hợp lệ                | Hash, metadata, thumbnail, audit       |
| EVID-002  | MIME giả/quá lớn              | Từ chối                                |
| EXP-001   | Xuất Excel                    | Mở được, đủ sheet, tổng đúng           |
| EXP-002   | Xuất GeoJSON                  | Geometry/ID/thuộc tính đúng            |
| AUDIT-001 | Khóa/mở khóa                  | Có actor, reason, time, traceId        |
| MAP-001   | Lọc ở cấp khu vực/lĩnh vực    | Hiện toàn bộ feature con phù hợp       |
| MAP-002   | Chọn feature                  | Highlight, zoom và thẻ gọn             |
| EXP-003   | Tải một/tập feature GeoJSON  | Đúng filter, quyền, hash và audit       |
| EDIT-001  | Sửa measurement confirmed     | Phiên bản mới, bắt buộc lý do          |

Task 4 có integration riêng bao phủ CRUD nháp, ETag lỗi thời, replay tạo/phân loại,
payload conflict, IDOR, tạo công tác/mục con trong transaction, hồ sơ khóa và
GeoJSON sai cấu trúc. Kiểm tra tổng xác nhận phải vẫn bằng 0 sau khi chỉ tạo nháp
hoặc measurement chưa xác nhận.

Task 5 có unit test cho hợp đồng ARIA của toolbar/drawer và chọn công tác tương
thích. E2E Chromium desktop/WebKit iPad kiểm bản đồ còn nhìn thấy khi mọi drawer
đóng, control tối thiểu 44 px, toolbar dọc/ngang theo breakpoint, mở/đóng drawer
bằng nút/Escape và các luồng GPS/route/import cũ vẫn truy cập được qua Nâng cao.

## 5. Ca kiểm thử ngoại tuyến

| Mã      | Tình huống                           | Kết quả mong đợi                                    |
| ------- | ------------------------------------ | --------------------------------------------------- |
| OFF-001 | Mất mạng khi đang vẽ                 | Bản nháp còn sau khi tải lại trang                  |
| OFF-002 | Bấm lưu nhiều lần khi mạng chập chờn | Máy chủ tạo một bản ghi                             |
| OFF-003 | Hai mutation cùng key khác payload   | Trả xung đột, không ghi đè                          |
| OFF-004 | Hồ sơ bị khóa trước khi đồng bộ      | Giữ bản cục bộ, báo xung đột                        |
| OFF-005 | Ảnh upload dở                        | Tiếp tục/thử lại, không tạo attachment hoàn tất giả |
| OFF-006 | Đồng bộ theo thứ tự khác             | Quan hệ vẫn đúng hoặc được retry có kiểm soát       |
| OFF-007 | Reload nháp chưa phân loại          | Geometry và trạng thái vẫn còn                       |
| OFF-008 | Classify khi hồ sơ vừa bị khóa      | Giữ nháp, báo conflict, không tạo measurement        |

## 6. Kiểm thử bản đồ và GPS

- Chuyển bản đồ nền không làm mất lớp dữ liệu đo.
- Attribution thay đổi đúng theo provider.
- Không gọi endpoint tile không chính thức.
- Geometry giữ đúng tọa độ khi zoom/pan/chuyển nền.
- Tắt quyền vị trí có hướng dẫn rõ.
- GPS accuracy hiển thị và được lưu.
- Tạm dừng GPS không nối các đoạn không hợp lý.
- Raw track giữ nguyên sau lọc nhiễu.
- Desktop có toolbar dọc; điện thoại/iPad có toolbar ngang trên, control chính tối
  thiểu 44 x 44 px và drawer đóng được để trả toàn bộ không gian cho bản đồ.
- Lùi/tiến và xóa phần đang chọn hoạt động cho point/line/polygon; từng đỉnh và chữ
  thập đỏ hiện đúng trong lúc vẽ.
- Kết quả tạm cập nhật trực tiếp nhưng luôn có nhãn phân biệt với số chính thức.

## 7. Kiểm thử bảo mật

- IDOR: người dùng không có quyền không đọc/sửa hồ sơ bằng UUID.
- Mass assignment: không sửa `createdBy`, `status`, `lockedAt` tùy ý.
- File upload: MIME spoof, tên tệp path traversal, tệp quá lớn.
- XSS: ghi chú, tên công tác và thuộc tính import.
- SQL/JSON injection qua bộ lọc.
- Rate limit cho login, route và export.
- Secret scan repository và build artifact.
- Dependency vulnerability scan.
- API khóa hồ sơ phải kiểm tra quyền và reason.
- IDOR trên capture draft, work component và download GeoJSON.
- Filter chỉ nhận trường/operator whitelist; tên cấp dữ liệu được escape chống XSS.

## 8. Kiểm thử hiệu năng

- 5.000 geometry trong một hồ sơ: tải theo bbox và phân trang.
- 1.000 phép đo trong một công tác: tổng hợp phía database.
- Export 10.000 dòng: tạo được trong giới hạn thời gian cấu hình.
- 100 ảnh chờ đồng bộ: không làm treo giao diện.
- Route provider chậm/timeout: UI có trạng thái và retry có giới hạn.

## 9. Dung sai ban đầu

Dung sai dùng để kiểm thử phần mềm, không phải chuẩn pháp lý:

- Chiều dài hình học chuẩn: sai khác không quá 0,5% hoặc 2 m, lấy mức lớn hơn.
- Diện tích chuẩn: sai khác không quá 0,5% hoặc 5 m², lấy mức lớn hơn.
- Kết quả trình duyệt và máy chủ: sai khác hiển thị không quá đơn vị làm tròn.
- GPS không có dung sai chung cố định; đánh giá theo accuracy của thiết bị và điều kiện đo.

## 10. Cổng phát hành

- 100% test công thức và migration đạt.
- Luồng E2E chính đạt trên Chrome và WebKit.
- Không có lỗi mức Critical/High chưa xử lý.
- Không có lỗi mất dữ liệu, nhân đôi, vượt quyền hoặc sai tổng.
- Backup/restore được kiểm tra ở staging.
- Tài liệu API, schema và danh mục mẫu đồng bộ.
- Người dùng nghiệm thu thực địa một hồ sơ mẫu trước production.

## 11. Tự động hóa Mốc 6

- `pnpm test:performance`: tạo 10.000 geometry trong PostGIS, yêu cầu tải dataset
  dưới 5 giây và tạo XLSX dưới 30 giây.
- CI có job backup/restore PostgreSQL + MinIO vào database/bucket tạm và xác minh
  SHA-256 manifest.
- Integration Mốc 6 kiểm IDOR giữa hai owner, security headers, no-store và login
  rate limit. E2E tiếp tục bắt buộc Chromium desktop và WebKit iPad.
- Chromium và WebKit chạy tuần tự trong một worker để tránh tranh chấp tài nguyên
  khi hai MapLibre/WebGL context khởi tạo đồng thời trên runner nhỏ.
- Field test và restore staging không thể thay bằng fixture local; kết quả phải ghi
  vào `12_FIELD_TEST_PROTOCOL.md` và runbook trước production.
