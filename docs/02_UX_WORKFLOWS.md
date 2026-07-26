# 02. Thiết kế màn hình và quy trình thao tác

## 1. Nguyên tắc giao diện

- Bản đồ là vùng làm việc trung tâm; danh mục và thuộc tính không che quá nhiều bản đồ.
- Mỗi thời điểm chỉ có một chế độ thao tác: xem, chọn, vẽ điểm, vẽ tuyến, vẽ vùng, định tuyến hoặc GPS.
- Luôn hiển thị trạng thái nháp và phân loại hiện tại; không bắt buộc chọn công tác
  trước khi bắt đầu vẽ.
- Kết quả tạm thời và kết quả máy chủ phải có nhãn khác nhau.
- Thao tác nguy cơ mất dữ liệu phải có xác nhận và khả năng khôi phục.
- Màu dùng theo nhóm dịch vụ nhưng trạng thái lỗi/cảnh báo ưu tiên màu hệ thống.

## 2. Điều hướng chính

| STT | Phân hệ            |
| --: | ------------------ |
|   1 | Tổng quan          |
|   2 | Hồ sơ kiểm tra     |
|   3 | Bản đồ hiện trường |
|   4 | Danh mục công tác  |
|   5 | Cơ sở xử lý rác    |
|   6 | Nhập/xuất dữ liệu  |
|   7 | Nhật ký            |
|   8 | Cài đặt            |

## 3. Màn hình máy tính

### 3.1. Danh sách hồ sơ

Hiển thị mã hồ sơ, địa bàn, thời kỳ, đơn vị, trạng thái, số công tác, tiến độ dữ liệu và lần sửa gần nhất. Bộ lọc được ghi nhớ theo người dùng.

Thao tác: tạo mới, mở, sao chép cấu trúc, lưu trữ, xuất nhanh.

### 3.2. Không gian kiểm tra map-first

- Bản đồ chiếm toàn bộ vùng nội dung sau header gọn. Không có panel trái/phải cố
  định; cây dữ liệu, tìm kiếm và thuộc tính mở bằng drawer nổi và đóng được hoàn toàn.
- Thanh biểu tượng dọc bên trái gồm điểm, chiều dài, diện tích, lùi, tiến, xóa phần
  đang chọn và kết thúc. Chọn đối tượng mở thẻ tóm tắt vừa nội dung, nền bán trong
  suốt; không đặt thẻ rộng cố định che bản đồ.
- Bộ chọn nền, trạng thái đồng bộ và tọa độ nằm trong các control gọn ở góc. GPS,
  route, ảnh, import và hệ số nằm trong menu **Nâng cao**.
- Chữ nội dung dùng thang responsive; nhãn phụ và số liệu không dùng cỡ tiêu đề.

### 3.3. Bảng đối chiếu

Cột chính: nhóm dịch vụ, công tác, đơn vị tính, dự toán, hợp đồng, nghiệm thu, kiểm tra, chênh lệch, tỷ lệ, cảnh báo, giải trình.

Nhấn vào một dòng sẽ lọc bản đồ theo công tác tương ứng.

## 4. Màn hình iPad/điện thoại

- Toàn màn hình ưu tiên bản đồ.
- Thanh công cụ ngang phía trên gồm điểm, chiều dài, diện tích, lùi, tiến, xóa và
  kết thúc; nút ít dùng nằm trong menu thêm.
- Danh sách và thuộc tính mở bằng bottom sheet.
- Riêng **Quản lý số liệu** mở thành sidebar hẹp toàn chiều cao ở cạnh trái để vẫn
  nhìn và thao tác trên bản đồ: khoảng 1/3 chiều rộng màn hình điện thoại. Trên máy
  tính sidebar này khoảng 1/7 chiều rộng. Nút rail cạnh trái cho phép mở hoặc thu
  gọn hoàn toàn; nút chỉ hiển thị biểu tượng ba gạch trong một ô vuông nhỏ đặt giữa
  cạnh màn hình, không hiển thị chữ. Các ngăn thuộc tính/nâng cao khác vẫn dùng
  drawer/bottom sheet.
- Thanh công cụ ngang phía trên dùng nút biểu tượng gọn, giảm phần đệm trên/dưới và
  tự co theo chiều rộng thiết bị để tất cả công cụ luôn hiện trong một hàng, không
  yêu cầu cuộn ngang.
- Nút thao tác chính tối thiểu khoảng 44 x 44 px. Riêng dải công cụ đo dày đặc phía
  trên dùng ô 32–36 px kèm nhãn trợ năng/tooltip để luôn hiện đủ trên một hàng;
  trạng thái GPS và ngoại tuyến luôn nhìn thấy.
- Trước khi lưu, hiển thị tóm tắt: loại phép đo, kết quả, sai số, số ảnh và cảnh báo.

## 5. Quy trình nghiệp vụ chính

### FLOW-01 — Tạo hồ sơ

1. Chọn “Tạo hồ sơ”.
2. Nhập tên, mã, địa bàn, phiên bản ranh giới và thời kỳ.
3. Chọn đơn vị được kiểm tra và cơ sở xử lý liên quan.
4. Chọn công tác từ danh mục hoặc sao chép cấu trúc hồ sơ mẫu.
5. Kiểm tra tóm tắt và tạo hồ sơ ở trạng thái nháp.

### FLOW-02 — Thêm công tác mới

1. Chọn khu vực quản lý và lĩnh vực dịch vụ.
2. Nhập tên công tác; có thể để trống khi chỉ lưu nháp thu thập.
3. Công cụ điểm/chiều dài/diện tích xác định rule cơ bản. Nếu cần hệ số hoặc công
   thức riêng, mở phần nâng cao và chọn template loại công tác.
4. Nhập kỳ thực hiện/ngưỡng cảnh báo nếu cần rồi lưu công tác vào hồ sơ.
5. Tạo một hoặc nhiều mục con có tên; có thể bỏ qua cấp này nếu công tác không cần.

### FLOW-03 — Đo trước, phân loại sau

1. Mở bản đồ và chọn Điểm, Chiều dài hoặc Diện tích mà không cần chọn công tác.
2. Vẽ; từng đỉnh có marker, điểm hiện hành có chữ thập đỏ. Dùng lùi/tiến, chọn và
   xóa một đỉnh hoặc phần đang chọn, rồi kết thúc.
3. Ứng dụng hiển thị phiếu nhỏ chỉ gồm tên công tác, khu vực trong 12 huyện/thành
   phố cũ, số liệu sát đơn vị (`m`, `m²`) và một nút **Lưu**.
4. Khi bấm **Lưu**, giao diện tự lưu geometry và phân loại nội bộ theo cấu hình loại
   công tác tương thích với công cụ đo; người dùng không phải qua hai bước “Lưu
   nháp” và “Lưu & phân loại”.
5. Máy chủ phân loại, kiểm tra geometry và tính kết quả trong một transaction.
6. Xử lý cảnh báo và xác nhận. Hệ số, ảnh và thuộc tính chi tiết được bổ sung trong
   phần **Nâng cao** khi công tác yêu cầu.

Thẻ đối tượng hiển thị trực tiếp tên, ngày lập, khu vực, số liệu, loại dịch vụ, màu
nét và các thao tác **Thêm**/sửa/xóa. **Thêm** khởi động đúng công cụ Điểm/Chiều
dài/Diện tích để tạo một phép đo mới trong cùng công tác, không ghi đè geometry cũ.
Với đối tượng diện tích đang hoạt động (nháp, cần xử lý hoặc đã xác nhận), nút
**Bớt** nằm cạnh **Thêm**. Người dùng vẽ
một vùng nằm hoàn toàn bên trong polygon; hệ thống lưu vùng này thành interior ring
trong phiên bản phép đo mới để PostGIS tính diện tích ròng. Vùng bớt dùng màu hồng
mận dịu, tách khỏi màu phần thêm; thẻ liệt kê **Vùng thêm 01…** và
**Vùng bớt 01…** kèm dấu trừ. Vùng bớt không được chạm biên, ra ngoài hoặc giao
vùng bớt đã có.
Mỗi phần bổ sung và mỗi vùng bớt có thao tác xóa riêng kèm xác nhận. Xóa phần bổ
sung chỉ xóa mềm measurement tương ứng; xóa vùng bớt tạo phiên bản polygon mới đã
gỡ đúng interior ring. Cả hai thao tác đều giữ nguyên đối tượng chính và lịch sử.
Sau khi kết thúc geometry bổ sung, drawer gọn chỉ hiển thị số liệu tạm, tên phần bổ
sung và một nút **Lưu**. Thẻ đối tượng hiển thị **Tổng số liệu** của các phép đo còn
hiệu lực, bên dưới là số thứ tự chuẩn **Điểm/Tuyến/Vùng 01, 02…** và số liệu của
từng lần đo để truy vết; tên đầy đủ của đối tượng chỉ hiển thị ở tiêu đề. Thẻ nằm ở
góc phải, đóng bằng nút ×, phím **Esc** hoặc nhấp ra ngoài thẻ.
Không hiển thị khu vực phân loại dưới nhãn **Địa chỉ**, vì 12
khu vực quản lý không có geometry để xác minh địa chỉ theo tọa độ. Nút **Thông tin**
được bỏ khỏi thẻ để giảm một bước và tiết kiệm không gian bản đồ; chọn đối tượng từ
**Quản lý số liệu** chỉ mở thẻ này, không tự mở thêm drawer thông tin và luôn đưa
bản đồ tới toàn bộ geometry của đối tượng, kể cả khi đối tượng đang ngoài viewport.
Trong **Quản lý số liệu**, mỗi công tác chỉ có một dòng đối tượng chính; các phép đo
bổ sung được thu gọn bên dưới dòng chính và chỉ bung khi người dùng cần xem/chọn.

### FLOW-03A — Quản lý cấu trúc dữ liệu

1. Mở drawer dữ liệu và chọn cấp khu vực, lĩnh vực, công tác hoặc mục con.
2. Thêm mới hoặc đổi tên tại chỗ; ID và liên kết dữ liệu không thay đổi.
3. Lưu trữ/xóa mềm yêu cầu xác nhận. Nếu cha còn con hoạt động, chuyển con sang nơi
   khác hoặc ngừng thao tác; không cascade xóa.
4. Mở danh sách đã xóa để phục hồi; mọi thao tác có audit.

### FLOW-03B — Tìm kiếm, mở, tải và chỉnh sửa

1. Mở tìm kiếm, nhập tên đối tượng/công tác/mục con hoặc chọn một danh mục Khu vực,
   Lĩnh vực, Công tác. Khi cần mới mở tùy chọn nâng cao cho mục con, loại geometry
   hoặc trạng thái.
2. Chọn feature trên bản đồ; hệ thống highlight, zoom và mở thẻ thông tin gọn.
3. Xem ngày lập/số liệu ngay trên thẻ hoặc chọn **Chỉnh sửa**.
4. Nháp được sửa trực tiếp. Phép đo đã xác nhận tạo phiên bản thay thế, yêu cầu lý
   do và giữ bản cũ trong lịch sử.

### FLOW-04 — Ghi GPS hiện trường

1. Chọn công tác và “Bắt đầu GPS”.
2. Ứng dụng kiểm tra quyền vị trí, pin và độ chính xác ban đầu.
3. Ghi hành trình; hiển thị quãng đường tạm, thời gian và sai số.
4. Có thể tạm dừng ở thời điểm dừng kiểm tra.
5. Kết thúc, xem lại tuyến và các đoạn sai số cao.
6. Lưu nháp ngoại tuyến hoặc gửi máy chủ.
7. Không tự xóa điểm sai; nếu lọc nhiễu phải lưu cả bản gốc và quy tắc lọc.

### FLOW-05 — Tính cự ly vận chuyển

1. Chọn công tác vận chuyển và “Tạo lộ trình”.
2. Chọn điểm xuất phát, trạm trung chuyển, cơ sở xử lý.
3. Thêm điểm bắt buộc nếu cần.
4. Chọn cấu hình xe và kiểu route.
5. Xem các phương án; chọn một phương án.
6. Nhập số lượt, khối lượng, hệ số chiều về.
7. Lưu route cùng provider, thời gian và geometry.
8. Nếu tính lại, tạo phiên bản mới và cho phép so sánh.

### FLOW-06 — Đối chiếu và khóa hồ sơ

1. Nhập khối lượng dự toán/hợp đồng/nghiệm thu.
2. Chọn “Tính đối chiếu”.
3. Xử lý cảnh báo thiếu dữ liệu, trùng geometry và chênh lệch.
4. Ghi giải trình và gắn tài liệu.
5. Chuyển trạng thái soát xét.
6. Xuất bản nháp, kiểm tra số liệu.
7. Khóa hồ sơ; hệ thống tạo snapshot kết quả và nhật ký.

## 6. Trạng thái và thông báo

- **Nháp:** chưa đưa vào tổng chính thức.
- **Đã gửi:** đang chờ máy chủ tính/kiểm tra.
- **Cần xử lý:** có lỗi hoặc cảnh báo chưa xác nhận.
- **Đã xác nhận:** được dùng để tổng hợp.
- **Đã thay thế:** còn trong lịch sử nhưng không cộng tổng.
- **Đã xóa mềm:** không hiển thị mặc định, có thể phục hồi.
- **Chưa phân loại:** geometry đã lưu an toàn nhưng chưa thuộc cấu trúc nghiệp vụ,
  không được cộng tổng hoặc xuất như kết quả chính thức.

Thông báo phải nói rõ hành động, đối tượng và cách xử lý; tránh dùng thông báo chung như “Có lỗi xảy ra”.

## 7. Khả năng truy cập và thao tác ngoài hiện trường

- Độ tương phản tối thiểu đáp ứng WCAG AA cho chữ và điều khiển chính.
- Không dùng màu làm tín hiệu duy nhất; kèm biểu tượng/nhãn.
- Hỗ trợ tăng cỡ chữ mà không che nút lưu.
- Cảnh báo GPS yếu bằng chữ và rung nếu thiết bị hỗ trợ.
- Khi pin thấp, nhắc lưu nháp và giảm tần suất GPS nếu người dùng đồng ý.
