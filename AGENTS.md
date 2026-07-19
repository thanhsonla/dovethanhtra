# AGENTS.md — Quy tắc làm việc của Codex

## 1. Nhiệm vụ của dự án

Phát triển ứng dụng kiểm tra khối lượng dịch vụ công ích đô thị trên bản đồ. Ưu tiên cao nhất là tính đúng, khả năng truy vết, bảo toàn bằng chứng và dễ sửa từng mô-đun.

## 2. Tài liệu phải đọc trước khi sửa mã

1. `README.md`.
2. `docs/01_PRD.md`.
3. Tài liệu chuyên đề tương ứng với nhiệm vụ.
4. `docs/07_TEST_PLAN.md`.
5. `docs/08_IMPLEMENTATION_PLAN.md`.

Nếu yêu cầu mới mâu thuẫn với tài liệu, không tự ý chọn. Ghi rõ điểm mâu thuẫn, đề xuất phương án và chờ quyết định nếu ảnh hưởng phạm vi, công thức hoặc giá trị chứng cứ.

## 3. Nguyên tắc kiến trúc

- Chia theo mô-đun nghiệp vụ: `cases`, `catalog`, `measurements`, `routing`, `evidence`, `comparison`, `exports`, `audit`, `sync`.
- Mô-đun giao tiếp qua interface hoặc service công khai; không truy cập bảng dữ liệu của mô-đun khác tùy tiện.
- Không để component giao diện gọi trực tiếp Mapbox, Google hoặc OSRM. Mọi gọi ngoài phải qua adapter.
- Ngoại lệ được chủ dự án chấp thuận tại ADR-022: `mt1.google.com` được dùng làm
  raster basemap qua `BasemapProvider`; component vẫn không được gọi trực tiếp,
  service worker không được cache và phải luôn có attribution/fallback.
- Không để công thức nghiệp vụ chỉ tồn tại trong giao diện. Máy chủ là nguồn kết quả chính thức.
- Không hard-code tên huyện, xã, nhóm dịch vụ, công tác, đơn vị tính hoặc ngưỡng cảnh báo.
- Mọi cấu hình công thức phải có `version` và được lưu cùng kết quả tính.
- Hạn chế tệp mã nguồn vượt 400 dòng; nếu vượt phải tách theo trách nhiệm.
- Không sửa đổi rộng ngoài phạm vi nhiệm vụ hiện tại.

## 4. Quy tắc dữ liệu không gian

- GeoJSON dùng thứ tự tọa độ `[longitude, latitude]`.
- Dữ liệu lưu trữ chuẩn ở EPSG:4326.
- Kết quả chiều dài/diện tích chính thức dùng kiểu `geography` hoặc phép biến đổi hệ tọa độ phù hợp trong PostGIS.
- Bắt buộc kiểm tra hình học hợp lệ trước khi xác nhận.
- Không tự động thay thế hình học gốc bằng hình học đã làm sạch; lưu bản gốc, bản chuẩn hóa và lý do.
- Tuyến định tuyến phải lưu nhà cung cấp, cấu hình, thời điểm, điểm đầu/cuối/trung gian và geometry trả về.
- Tuyến GPS phải lưu độ chính xác và thời gian của từng điểm nếu thiết bị cung cấp.

## 5. Bằng chứng và nhật ký

- Không xóa cứng hồ sơ, phép đo, tuyến hoặc ảnh nghiệp vụ.
- Sửa phép đo đã xác nhận phải tạo phiên bản mới hoặc sự kiện hiệu chỉnh.
- Ảnh gốc được lưu riêng; bản thu nhỏ không thay thế ảnh gốc.
- Lưu hash của tệp đính kèm, người tạo, thời gian và bản ghi liên kết.
- Mọi thao tác xác nhận, khóa, mở khóa, xóa mềm, phục hồi và xuất báo cáo phải ghi nhật ký.

## 6. Bảo mật

- Không commit `.env`, khóa API, token, mật khẩu hoặc URL có chữ ký.
- Khóa Mapbox/Google phía trình duyệt phải được giới hạn domain, API và quota khi nhà cung cấp hỗ trợ.
- Endpoint tải/xuất tệp phải kiểm tra quyền trên máy chủ.
- Dữ liệu đầu vào, tên tệp và thuộc tính GeoJSON phải được kiểm tra, giới hạn kích thước.
- Không ghi tọa độ, token hoặc dữ liệu nhạy cảm vào log ở mức không cần thiết.

## 7. Kiểm thử bắt buộc

Mỗi thay đổi phải có kiểm thử tương ứng. Trước khi kết thúc nhiệm vụ, chạy tối thiểu:

- Lint và type-check.
- Unit test cho công thức hoặc logic thay đổi.
- Integration test nếu thay API/cơ sở dữ liệu.
- Kiểm tra migration tiến và lùi nếu có migration.
- E2E luồng chính nếu thay giao diện nghiệp vụ.

Đối với phép đo, dùng bộ mẫu chuẩn: tuyến 1 km, polygon 1 ha, polygon lỗi, tuyến trùng, tuyến qua ranh giới và lộ trình không tìm được đường.

## 8. Cách hoàn thành một nhiệm vụ

Trong phản hồi cuối của mỗi nhiệm vụ, Codex phải ghi:

1. Kết quả đã làm.
2. Tệp đã thay đổi.
3. Kiểm thử đã chạy và kết quả.
4. Rủi ro hoặc việc còn lại.
5. Cập nhật `docs/PROJECT_CONTEXT.md` nếu quyết định hoặc trạng thái dự án thay đổi.

Không tuyên bố hoàn thành nếu chưa chạy được kiểm thử liên quan. Nếu môi trường ngăn cản kiểm thử, ghi rõ lệnh cần chạy và nguyên nhân.
