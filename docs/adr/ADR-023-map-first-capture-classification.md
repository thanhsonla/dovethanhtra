# ADR-023: Không gian map-first và quy trình đo trước, phân loại sau

- Trạng thái: Accepted
- Ngày: 20/07/2026

## Bối cảnh

Không gian kiểm tra hiện yêu cầu chọn công tác trước khi vẽ và dành nhiều diện tích
cho cây dữ liệu, thẻ tiến độ và phiếu thuộc tính. Cách này bảo đảm phép đo có đủ ngữ
cảnh ngay từ đầu nhưng làm giảm vùng bản đồ và tăng số bước khi người dùng cần ghi
nhanh nhiều điểm, tuyến hoặc vùng ngoài hiện trường.

Nhu cầu mới yêu cầu bản đồ toàn màn hình, ba công cụ đo chính và khả năng lưu hình
học trước rồi bổ sung khu vực, lĩnh vực, công tác và mục con sau. Đồng thời, dữ liệu
đã xác nhận vẫn phải truy vết được, tổng chính thức vẫn do máy chủ tính và cấu trúc
75 xã, phường hiện hành không được thay thế bằng 12 khu vực quản lý lịch sử.

## Quyết định

### 1. Không gian làm việc map-first

- Bản đồ là bề mặt chính. Desktop dùng thanh công cụ biểu tượng theo chiều dọc bên
  trái; điện thoại/iPad dùng thanh ngang phía trên. Panel danh sách, bộ lọc và chi
  tiết chỉ mở dưới dạng drawer hoặc bottom sheet và có thể đóng hoàn toàn.
- Thanh công cụ nhanh gồm các thao tác điểm, chiều dài, diện tích, lùi, tiến, xóa
  phần đang chọn và kết thúc. Mỗi nút có nhãn truy cập, tooltip và vùng chạm tối
  thiểu 44 x 44 px.
- GPS, route, ảnh, import và các hệ số/công thức vẫn được bảo toàn nhưng chuyển vào
  luồng nâng cao; không xóa chức năng hoặc dữ liệu hiện có.
- Trình duyệt chỉ hiển thị số đo tạm. Kết quả chiều dài, diện tích và số lượng chính
  thức tiếp tục được PostGIS tính và phiên bản hóa ở máy chủ.

### 2. Phân cấp quản lý

Phân cấp làm việc là:

`Khu vực quản lý → Lĩnh vực dịch vụ → Công tác → Mục con → Phép đo`.

- 12 huyện/thành phố cũ được quản lý như một lớp khu vực nghiệp vụ có version,
  nguồn và thời hạn hiệu lực riêng. Chúng không thay thế và không làm thay đổi danh
  mục 75 xã, phường hiện hành hoặc snapshot ranh giới pháp lý của hồ sơ.
- Bốn lĩnh vực hiển thị mặc định là `Vệ sinh môi trường`, `Chiếu sáng`, `Cây xanh`
  và `Thoát nước thải`. Đây là seed/cấu hình hiển thị, không phải enum hard-code;
  nhóm lịch sử khác vẫn đọc được và quản trị viên có thể thêm hoặc ngừng sử dụng.
- Công tác được phép bắt đầu với tên trống trong bước thu thập nhanh nhưng phải có
  tên trước khi xác nhận. `case_work_item` gắn trực tiếp với khu vực quản lý và lĩnh
  vực; `work_type` trở thành template công thức nâng cao tùy chọn. Dữ liệu cũ được
  backfill quan hệ trực tiếp từ template hiện có mà vẫn giữ `work_type_id`.
- `work_component` là mục con tùy chọn có tên riêng, ví dụ từng tuyến đường trong
  công tác “Chiều dài đường”. Một mục con có thể chứa nhiều phép đo rời nhau và tổng
  của mục con/công tác chỉ gồm phép đo đã xác nhận.
- Thêm, đổi tên, lưu trữ, xóa mềm và phục hồi được hỗ trợ ở mọi cấp có thể chỉnh
  sửa. ID ổn định; đổi tên không đổi liên kết. Xóa cha không cascade xóa chứng cứ
  con và mọi mutation phải có audit; hệ thống từ chối lưu trữ cha nếu còn con hoạt
  động, trừ khi người dùng chuyển các con sang nơi khác.

### 3. Đo trước, phân loại sau

- `capture_draft` là vùng đệm hình học chưa phân loại do mô-đun `measurements` sở
  hữu. Nó lưu raw geometry, loại geometry, phương pháp, thiết bị, người tạo, thời
  gian, trạng thái đồng bộ và idempotency; không phải phép đo chính thức.
- Trạng thái dự kiến: `unclassified`, `classifying`, `classified`, `conflict` và
  `deleted`. Nháp chưa phân loại không được cộng tổng, đối chiếu, khóa vào snapshot
  hoặc xuất như kết quả chính thức.
- Người dùng có thể vẽ và lưu ngay, sau đó chọn hoặc tạo khu vực, lĩnh vực, công tác
  và mục con. Thao tác phân loại chạy trong một transaction: kiểm tra quyền/ETag,
  tạo hoặc liên kết cấu trúc, tạo measurement từ raw geometry, tính/validate phía
  máy chủ, liên kết measurement với nháp, đổi trạng thái nháp và ghi audit.
- Gửi lại cùng `Idempotency-Key` và payload trả kết quả cũ; cùng khóa khác payload
  trả conflict. Hồ sơ đã khóa không nhận phân loại mới và giữ nháp cục bộ để xử lý.

### 4. Tìm kiếm, tải xuống và chỉnh sửa

- Bản đồ hỗ trợ lọc độc lập hoặc kết hợp theo khu vực, lĩnh vực, công tác, mục con,
  loại geometry và trạng thái. Dừng ở cấp nào thì trả toàn bộ đối tượng phù hợp ở
  cấp đó; truy vấn lớn dùng bbox, cursor và giới hạn khai báo.
- Chọn đối tượng sẽ highlight, zoom phù hợp và mở thẻ chi tiết gọn. Từ đó người có
  quyền có thể mở thông tin, tải GeoJSON hoặc chỉnh sửa.
- GeoJSON là định dạng tải nhanh mặc định; tải một đối tượng hoặc tập đang lọc đều
  kiểm quyền phía máy chủ, ghi bộ lọc, hash và audit. Xuất hồ sơ chính thức vẫn tuân
  theo snapshot/khóa hiện hành.
- Nháp được sửa trực tiếp bằng optimistic concurrency. Phép đo đã xác nhận không bị
  ghi đè; chỉnh geometry hoặc phân loại tạo phiên bản superseding và bắt buộc lý do.

## Hệ quả

Người dùng có thể ghi nhận geometry ngay khi mở bản đồ và hoàn thiện thông tin sau,
trong khi dữ liệu chưa phân loại không làm sai tổng chính thức. Mô hình mới cần
migration thêm `work_component`, `capture_draft` và liên kết tùy chọn từ measurement;
việc backfill giữ liên kết trực tiếp của dữ liệu cũ, bổ sung khu vực/lĩnh vực có
provenance và không tự đổi kết quả đã xác nhận.

API và PWA cần được triển khai theo lát cắt riêng sau ADR này. ADR không cấp phép
hard-delete, không thay đổi công thức/hệ số hợp đồng, không biến 12 khu vực quản lý
thành địa giới pháp lý và không coi nháp chưa phân loại là bằng chứng đã xác nhận.
