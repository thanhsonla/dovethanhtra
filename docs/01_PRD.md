# 01. Đặc tả yêu cầu sản phẩm — PRD MVP v1

## 1. Bối cảnh và vấn đề

Khối lượng dịch vụ công ích hiện được thể hiện trong hợp đồng, dự toán, bảng nghiệm thu và báo cáo của đơn vị thực hiện. Khi kiểm tra thực địa, cán bộ phải đối chiếu nhiều tuyến đường, vị trí, diện tích và cự ly vận chuyển. Việc đo thủ công trên nhiều công cụ rời rạc làm khó truy vết nguồn số liệu, dễ cộng trùng và mất thời gian tổng hợp.

Ứng dụng cần tạo một không gian làm việc thống nhất: đo trực tiếp trên bản đồ hoặc
ghi GPS, lưu nhanh geometry trước khi phân loại, gắn nhiều vị trí cho cùng một mục
con/công tác, đính kèm bằng chứng, tổng hợp và so sánh với số liệu nguồn.

## 2. Mục tiêu sản phẩm

- Rút ngắn thời gian xác định khối lượng và cự ly.
- Bảo đảm mỗi kết quả có thể truy ngược đến phép đo và bằng chứng.
- Phát hiện tuyến/vùng trùng lặp hoặc chênh lệch bất thường.
- Chuẩn hóa dữ liệu kiểm tra giữa các huyện và nhóm dịch vụ.
- Tạo nền tảng mở rộng cho biểu mẫu thanh tra, dashboard và báo cáo chuyên sâu.

## 3. Người dùng và vai trò

### 3.1. Chủ hồ sơ

Tạo, sửa, đo, nhập số liệu nguồn, xác nhận, khóa và xuất hồ sơ. Đây là vai trò sử dụng chính trong MVP.

### 3.2. Người xem/soát xét

Chỉ xem, bình luận hoặc đề nghị hiệu chỉnh. Vai trò được thiết kế trong dữ liệu nhưng có thể chưa bật trong giao diện MVP.

### 3.3. Quản trị danh mục

Quản lý nhóm dịch vụ, công tác, đơn vị tính, công thức và địa giới. Trong bản cá nhân, chủ hồ sơ đồng thời có quyền này.

## 4. Thuật ngữ

- **Hồ sơ kiểm tra:** tập hợp dữ liệu kiểm tra của một địa bàn, thời kỳ và đơn vị/công việc.
- **Khu vực quản lý:** nhãn nghiệp vụ như tên 12 huyện/thành phố cũ, không có hình
  học và không thay thế địa giới 75 xã/phường hiện hành dùng trên bản đồ/snapshot.
- **Lĩnh vực dịch vụ:** nhóm công ích cấu hình được; giao diện nhanh hiển thị bốn
  lĩnh vực mặc định nhưng vẫn bảo toàn nhóm lịch sử.
- **Loại công tác:** template công thức nâng cao tùy chọn cho một công việc như quét
  đường, cắt cỏ, cắt tỉa cây.
- **Công tác hồ sơ:** công việc thuộc trực tiếp một khu vực và lĩnh vực trong hồ sơ;
  có thể dùng template công thức nâng cao.
- **Mục con:** bộ phận có tên thuộc một công tác, ví dụ một tên đường; có thể chứa
  nhiều phép đo rời nhau.
- **Nháp thu thập:** geometry đã lưu nhưng chưa được phân loại đầy đủ; không phải
  phép đo chính thức và không được cộng tổng.
- **Phép đo:** một bản ghi điểm, tuyến, vùng, số lượng hoặc lộ trình.
- **Khối lượng nguồn:** khối lượng hợp đồng, dự toán, báo cáo hoặc nghiệm thu.
- **Khối lượng kiểm tra:** kết quả tổng hợp từ các phép đo đã xác nhận.
- **Cơ sở xử lý:** bãi rác, nhà máy hoặc điểm kết thúc lộ trình.
- **Cự ly định tuyến:** khoảng cách do bộ định tuyến tính theo dữ liệu đường.
- **Cự ly GPS:** khoảng cách từ hành trình GPS thực tế.

## 5. Phạm vi chức năng

### FR-CASE — Hồ sơ kiểm tra

- **FR-CASE-001:** Tạo hồ sơ với tên, mã, địa bàn, thời kỳ, đơn vị được kiểm tra và mô tả.
- **FR-CASE-002:** Chọn phiên bản địa giới áp dụng; một hồ sơ không tự đổi ranh giới khi danh mục cập nhật.
- **FR-CASE-003:** Trạng thái gồm `draft`, `in_progress`, `review`, `locked`, `archived`.
- **FR-CASE-004:** Sao chép cấu trúc công tác từ hồ sơ trước nhưng không sao chép kết quả đo nếu người dùng không chọn.
- **FR-CASE-005:** Khóa hồ sơ; mở khóa phải ghi lý do và nhật ký.
- **FR-CASE-006:** Tìm kiếm theo địa bàn, thời kỳ, đơn vị, trạng thái và nhóm dịch vụ.

### FR-CAT — Danh mục dịch vụ và công tác

- **FR-CAT-001:** Giao diện nhanh có sẵn bốn lĩnh vực mặc định: Vệ sinh môi trường,
  Chiếu sáng, Cây xanh và Thoát nước thải. Danh mục vẫn cấu hình được và giữ các
  nhóm lịch sử đang có dữ liệu.
- **FR-CAT-002:** Thêm, sửa, ngừng sử dụng nhóm dịch vụ mà không làm mất hồ sơ cũ.
- **FR-CAT-003:** Tạo loại công tác với mã, tên, đơn vị, kiểu đo và quy tắc tính.
- **FR-CAT-004:** Kiểu đo hỗ trợ `count`, `point`, `line`, `area`, `route`, `composite`.
- **FR-CAT-005:** Cấu hình trường thuộc tính bắt buộc, kiểu dữ liệu, danh sách chọn và ngưỡng hợp lệ.
- **FR-CAT-006:** Phiên bản hóa quy tắc tính; hồ sơ cũ tiếp tục dùng phiên bản đã lưu.
- **FR-CAT-007:** Quản lý khu vực nghiệp vụ dưới dạng danh mục tên có version, đổi
  tên/xóa mềm/phục hồi; không tạo ranh giới riêng. Bản đồ chỉ dùng địa giới 75
  xã/phường hiện hành theo nguồn/version hành chính.

### FR-WORK — Công tác trong hồ sơ

- **FR-WORK-001:** Thêm nhiều công tác từ danh mục vào từng hồ sơ.
- **FR-WORK-002:** Cho phép đặt tên cụ thể, ví dụ “Quét đường khu trung tâm tháng 3/2025”.
- **FR-WORK-003:** Ghi khối lượng nguồn theo các loại: dự toán, hợp đồng, báo cáo, nghiệm thu, khác.
- **FR-WORK-004:** Một công tác chứa không giới hạn phép đo về mặt nghiệp vụ; giao diện phân trang khi số lượng lớn.
- **FR-WORK-005:** Tổng khối lượng chỉ lấy phép đo ở trạng thái được phép tính.
- **FR-WORK-006:** Công tác cho phép tên trống khi mới thu thập nhưng phải có tên
  trước khi xác nhận phép đo.
- **FR-WORK-007:** Thêm, đổi tên, lưu trữ, xóa mềm và phục hồi mục con; một mục con
  chứa nhiều phép đo và hiển thị tổng cùng số liệu từng phần.
- **FR-WORK-008:** Đổi tên giữ nguyên ID; xóa cha không cascade xóa dữ liệu con và
  mọi thay đổi cấu trúc phải ghi audit.

### FR-MEAS — Phép đo bản đồ

- **FR-MEAS-001:** Tạo phép đo điểm, đa điểm, tuyến, đa tuyến, vùng và đa vùng.
- **FR-MEAS-002:** Vẽ mới, sửa đỉnh, hoàn tác, làm lại và hủy thao tác.
- **FR-MEAS-003:** Bắt điểm vào đường/đối tượng gần nhất khi người dùng bật chế độ này.
- **FR-MEAS-004:** Ghi vị trí hiện tại và độ chính xác GPS.
- **FR-MEAS-005:** Ghi hành trình GPS; cho phép tạm dừng và tiếp tục.
- **FR-MEAS-006:** Nhập GeoJSON, KML hoặc GPX ở giai đoạn sau; MVP bắt buộc GeoJSON.
- **FR-MEAS-007:** Hiển thị kết quả tạm thời khi vẽ; máy chủ tính lại khi lưu.
- **FR-MEAS-008:** Lưu phương pháp, nguồn geometry, người tạo, thời gian, thiết bị và ghi chú.
- **FR-MEAS-009:** Kiểm tra hình học hợp lệ, trùng lặp và nằm ngoài địa bàn.
- **FR-MEAS-010:** Xác nhận phép đo; sửa sau xác nhận tạo phiên bản mới.
- **FR-MEAS-011:** Cho phép lưu nháp điểm, tuyến hoặc vùng trước khi chọn khu vực,
  lĩnh vực, công tác và mục con tùy chọn.
- **FR-MEAS-012:** Nháp chưa phân loại không tham gia tổng, đối chiếu, snapshot hoặc
  export kết quả chính thức.
- **FR-MEAS-013:** Phân loại nháp và tạo phép đo diễn ra trong một transaction có
  idempotency, optimistic concurrency và audit.
- **FR-MEAS-014:** Thanh công cụ nhanh có điểm, chiều dài, diện tích, lùi, tiến, xóa
  phần đang chọn và kết thúc; hệ số/công thức chuyển vào luồng nâng cao.

### FR-ROUTE — Cự ly vận chuyển

- **FR-ROUTE-001:** Quản lý điểm tập kết, trạm trung chuyển và cơ sở xử lý.
- **FR-ROUTE-002:** Chọn điểm đầu, điểm cuối và nhiều điểm trung gian.
- **FR-ROUTE-003:** Tính lộ trình qua `RoutingProvider`, trả về geometry, chiều dài và thời gian dự kiến.
- **FR-ROUTE-004:** Lưu cự ly một chiều, hệ số lượt về, số lượt, khối lượng và kết quả quy đổi.
- **FR-ROUTE-005:** Cho phép người dùng thêm điểm cưỡng bức hoặc chọn phương án tuyến khác.
- **FR-ROUTE-006:** Phân biệt rõ `drawn`, `routed`, `gps_track`, `manual_document`.
- **FR-ROUTE-007:** Không ghi đè tuyến cũ khi tính lại; tạo phiên bản tuyến.
- **FR-ROUTE-008:** Cảnh báo nếu điểm cuối không khớp cơ sở xử lý hoặc route đi ngoài vùng hợp lý.

### FR-EVID — Bằng chứng

- **FR-EVID-001:** Gắn nhiều ảnh/tài liệu cho phép đo và công tác.
- **FR-EVID-002:** Lưu tệp gốc, thumbnail, hash, kích thước, người tải và thời gian.
- **FR-EVID-003:** Nếu có, đọc metadata vị trí/thời gian nhưng không coi là đúng tuyệt đối.
- **FR-EVID-004:** Cho phép chú thích ảnh; chú thích không sửa tệp gốc.
- **FR-EVID-005:** Xóa mềm; phục hồi có nhật ký.

### FR-COMP — Đối chiếu

- **FR-COMP-001:** Tổng hợp khối lượng kiểm tra theo công tác, nhóm dịch vụ và hồ sơ.
- **FR-COMP-002:** Tính chênh lệch tuyệt đối và tỷ lệ so với từng khối lượng nguồn.
- **FR-COMP-003:** Cấu hình ngưỡng cảnh báo theo công tác hoặc hồ sơ.
- **FR-COMP-004:** Cho phép giải trình chênh lệch và gắn tài liệu.
- **FR-COMP-005:** Không tự kết luận sai phạm; chỉ thể hiện số liệu và cảnh báo.

### FR-MAP — Bản đồ và lớp dữ liệu

- **FR-MAP-001:** Chuyển bản đồ nền qua `BasemapProvider`.
- **FR-MAP-002:** Hiển thị/ẩn theo nhóm dịch vụ, công tác, trạng thái và loại geometry.
- **FR-MAP-003:** Hiển thị ranh giới địa bàn, cơ sở xử lý và dữ liệu phép đo.
- **FR-MAP-004:** Hiển thị attribution phù hợp với nhà cung cấp hiện hành.
- **FR-MAP-005:** Không lưu cache trái điều kiện nguồn bản đồ; lớp ngoại tuyến phải dùng nguồn được phép.
- **FR-MAP-006:** Không gian đo ưu tiên bản đồ toàn màn hình; danh sách, bộ lọc và
  chi tiết mở bằng drawer/bottom sheet có thể đóng hoàn toàn.
- **FR-MAP-007:** Lọc theo khu vực, lĩnh vực, công tác, mục con, loại geometry và
  trạng thái; bộ lọc ở cấp cha trả mọi đối tượng con phù hợp.
- **FR-MAP-008:** Chọn đối tượng sẽ highlight, zoom và mở tóm tắt gọn với thao tác
  mở thông tin, tải GeoJSON và chỉnh sửa theo quyền.

### FR-EXP — Nhập/xuất

- **FR-EXP-001:** Xuất Excel gồm hồ sơ, công tác, từng phép đo, khối lượng nguồn và chênh lệch.
- **FR-EXP-002:** Xuất GeoJSON giữ thuộc tính nghiệp vụ và mã liên kết.
- **FR-EXP-003:** Mỗi lần xuất ghi người dùng, thời gian, bộ lọc và hash tệp.
- **FR-EXP-004:** Không xuất token, đường dẫn nội bộ hoặc thông tin hệ thống không cần thiết.
- **FR-EXP-005:** Cho phép tải GeoJSON một đối tượng hoặc tập đang lọc; máy chủ kiểm
  quyền, lưu bộ lọc, hash và audit.

### FR-AUDIT — Nhật ký

- **FR-AUDIT-001:** Ghi tạo, sửa, xác nhận, khóa, mở khóa, xóa mềm, phục hồi, nhập và xuất.
- **FR-AUDIT-002:** Nhật ký chỉ thêm mới; người dùng thông thường không sửa/xóa.
- **FR-AUDIT-003:** Hiển thị lịch sử theo hồ sơ, công tác hoặc phép đo.

## 6. Yêu cầu phi chức năng

- **NFR-001 — Hiệu năng:** mở hồ sơ có 5.000 đối tượng trong tối đa 5 giây trên kết nối ổn định; dùng phân trang và tải theo vùng nhìn.
- **NFR-002 — Phản hồi bản đồ:** thao tác pan/zoom mục tiêu tối thiểu 30 FPS trên iPad mục tiêu.
- **NFR-003 — Sẵn sàng ngoại tuyến:** tạo và lưu nháp phép đo khi mất mạng; không cam kết tải bản đồ nền Google ngoại tuyến.
- **NFR-004 — Tính nhất quán:** đồng bộ lặp lại không tạo bản ghi trùng.
- **NFR-005 — An toàn dữ liệu:** sao lưu tự động, phục hồi thử nghiệm và không xóa cứng dữ liệu nghiệp vụ.
- **NFR-006 — Truy vết:** mọi kết quả có ID, phiên bản quy tắc, phương pháp và nguồn.
- **NFR-007 — Khả dụng:** giao diện tiếng Việt, nút đo đủ lớn trên iPad/điện thoại.
- **NFR-008 — Bảo mật:** bí mật tách khỏi mã nguồn; kiểm tra quyền tại máy chủ.
- **NFR-009 — Khả chuyển đổi:** thay nhà cung cấp bản đồ/định tuyến không sửa mô hình nghiệp vụ.

## 7. Tiêu chí nghiệm thu cấp sản phẩm

1. Tạo hồ sơ Mộc Châu, hiển thị bốn lĩnh vực mặc định và đọc được nhóm lịch sử.
2. Vẽ một tuyến khi chưa chọn công tác, nhập tên/khu vực và bấm **Lưu** trên phiếu
   gọn; hệ thống tự lưu nháp và phân loại nội bộ mà không tạo bản ghi trùng khi gửi lại.
3. Trong một mục con, lưu ba tuyến độc lập; tổng mục con và công tác đúng bằng tổng
   phép đo đã xác nhận.
4. Đo polygon chuẩn 10.000 m² và tuyến chuẩn 1.000 m đạt dung sai kiểm thử.
5. Lọc theo khu vực/lĩnh vực/công tác, chọn một đối tượng để mở, tải GeoJSON và sửa;
   sửa bản confirmed tạo phiên bản mới có lý do.
6. Tạo route từ điểm tập kết đến khu xử lý, lưu đầy đủ provider và geometry.
7. Tạo một phép đo GPS khi mất mạng, đồng bộ lại mà không trùng dữ liệu.
8. Nhập khối lượng nghiệm thu, hiển thị chênh lệch và cảnh báo theo ngưỡng.
9. Xuất Excel và GeoJSON mở được, số liệu khớp giao diện.
10. Khóa hồ sơ ngăn sửa; mở khóa bắt buộc lý do và có nhật ký.

## 8. Phụ thuộc và giả định

- Có tài khoản và khóa API hợp lệ cho nguồn bản đồ/định tuyến được chọn.
- Có hoặc sẽ chuẩn hóa dữ liệu ranh giới địa bàn.
- Thiết bị hiện trường cho phép truy cập vị trí và máy ảnh.
- Công thức thanh toán chi tiết sẽ cấu hình theo từng công tác/hợp đồng, không suy diễn từ sổ kế toán.
