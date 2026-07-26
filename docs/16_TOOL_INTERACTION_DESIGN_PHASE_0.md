# Thiết kế Giai đoạn 0 — Công cụ bản đồ và hệ icon

> Chốt ngày 26/07/2026. Tài liệu này là đầu ra thiết kế, không thay đổi dữ liệu,
> công thức, API hoặc trạng thái phép đo.

## 1. Mục tiêu và ranh giới

Mục tiêu là giảm số thao tác ngoài hiện trường, làm công cụ dễ nhận biết trên nền
vệ tinh và thống nhất phong cách icon. Bản đồ vẫn là vùng làm việc chính; drawer,
bộ lọc và thông tin đối tượng chỉ mở khi người dùng cần.

Giai đoạn 0 chỉ chốt thiết kế và backlog. Giai đoạn 1 chỉ được phép thay đổi giao
diện của công cụ đã hoạt động; không mở rộng phép đo, không thay đổi công thức
PostGIS, dữ liệu geometry, audit, offline queue hoặc quyền.

Các ràng buộc bắt buộc:

- Kết quả chính thức vẫn do máy chủ/PostGIS tính và lưu version.
- Xóa, phục hồi và hiệu chỉnh vẫn đi qua API/audit; không tạo “undo” chỉ ở client
  cho dữ liệu đã lưu.
- Điều khiển cảm ứng chính tối thiểu 44 x 44 px; desktop tối thiểu 36 x 36 px.
- Không dùng màu là tín hiệu duy nhất; trạng thái phải có nhãn ARIA, nền/viền và
  tooltip hoặc nhãn khi nhấn giữ.
- Không thêm thư viện icon vào JavaScript. Gói bản đồ hiện chỉ còn khoảng 0,77 kB
  raw trước trần 1.100 kB; icon phải dùng SVG nội bộ được tối ưu hoặc asset tĩnh.

## 2. Kết quả rà soát hiện trạng

| Nhóm | Đã hoạt động và được hiển thị | Quyết định Giai đoạn 1 |
| --- | --- | --- |
| Đo chính | Điểm, Chiều dài, Diện tích; phím `P`, `D`, `A` | Giữ là ba nút chính. |
| Hiệu chỉnh nháp | Lùi, Tiến, Xóa đỉnh, Hoàn tất, Hủy | Chỉ hiện khi đang vẽ hoặc sửa. |
| Hỗ trợ vẽ | Bắt điểm, Kính lúp 2x | Bắt điểm hiện trong lúc vẽ; Kính lúp nằm ở menu phụ. |
| Quản lý | Dữ liệu, Tìm kiếm, Nâng cao | Dữ liệu/Tìm kiếm hiển thị; Nâng cao nằm trong menu phụ có nhãn rõ. |
| Header | Chế độ Chuẩn/Chói nắng/Đêm, ranh giới, nền bản đồ | Đổi emoji thành icon SVG đồng nhất. |
| Đã loại bỏ | Hình chữ nhật, Ortho, phím `R`/`Shift` | Không đưa vào UI, shortcut hoặc backlog. |

Hình chữ nhật và Ortho không thuộc bộ công cụ của sản phẩm. Các icon nội bộ và mô tả
từng có đã được loại bỏ để không tạo kỳ vọng sai về tính năng.

## 3. Kiến trúc thao tác được chốt

### 3.1. Chế độ xem

```text
[Điểm] [Chiều dài] [Diện tích] | [Dữ liệu] [Tìm kiếm] [Lớp] [Thêm]
```

- Ba công cụ đo luôn xuất hiện, theo thứ tự tần suất sử dụng.
- **Dữ liệu** mở drawer quản lý; **Tìm kiếm** mở bộ tìm kiếm; **Lớp** mở lựa chọn
  hiển thị nền/ranh giới/chế độ thực địa.
- **Thêm** chứa Kính lúp, Nâng cao, phím tắt và các tiện ích ít dùng.
- Không hiển thị Lùi/Tiến/Xóa/Hoàn tất trong chế độ xem vì không có tác dụng.

### 3.2. Chế độ đang vẽ hoặc sửa geometry

```text
[Loại đang vẽ] | [Bắt điểm] [Lùi] [Tiến] [Xóa đỉnh] | [Hoàn tất] [Hủy]
```

- Nhãn loại đang vẽ là thông tin trạng thái, không phải nút tạo phép đo mới.
- **Bắt điểm** giữ ở thanh chính khi đang vẽ vì ảnh hưởng trực tiếp đến tọa độ.
- **Hoàn tất** là hành động chính; **Hủy** luôn ở cuối để không nhầm với xóa đỉnh.
- Kính lúp và hướng dẫn phím tắt nằm trong menu phụ, không che thao tác số hóa.

### 3.3. Khi chọn một đối tượng đã lưu

Thẻ đối tượng tiếp tục là nơi thể hiện nội dung và số liệu. Dải hành động chỉ hiện
những việc hợp lệ với object đang chọn:

| Loại đối tượng | Hành động trực tiếp | Trong menu phụ |
| --- | --- | --- |
| Điểm/Tuyến | Thêm, Sửa | Ảnh, Tải GeoJSON, Xóa mềm |
| Vùng | Thêm, Bớt, Sửa | Ảnh, Tải GeoJSON, Xóa mềm |
| Route | Xem/Sửa route khi được quyền | Tải GeoJSON, lịch sử |

Nút **Bớt** chỉ xuất hiện với vùng ở trạng thái nghiệp vụ đã cho phép. Xóa vẫn có
xác nhận và không thay đổi nguyên tắc xóa mềm/version hiện có.

## 4. Hệ icon “Field Precision”

### 4.1. Quy chuẩn hình học

- Artboard `24 x 24`; vùng nhìn chính 20 px; stroke mặc định `1.8 px`, round cap
  và round join.
- Mỗi hành động dùng một biểu tượng duy nhất trong toàn ứng dụng; không trộn emoji
  với SVG ở toolbar, header, sidebar và thẻ đối tượng.
- Icon tạo/số hóa là outline; icon hành động nguy hiểm không tô kín hoàn toàn để
  tránh cảm giác cảnh báo thường trực.
- Asset chỉ bao gồm icon được dùng. Các icon panel hoặc thẻ lazy-load đi cùng chunk
  tương ứng; không thêm package icon bên thứ ba.

### 4.2. Trạng thái màu và phản hồi

| Trạng thái | Biểu đạt | Màu tham chiếu |
| --- | --- | --- |
| Bình thường | Nền trong/nhẹ, icon xanh than | `#244d3e` |
| Hover/focus | Viền và nền sáng hơn | `#e8f3ed` |
| Đang bật | Nền xanh lá đậm, icon trắng, `aria-pressed=true` | `#176c4c` |
| Hoàn tất | Nền xanh lá, icon dấu tích | `#176c4c` |
| Hủy/xóa | Viền hoặc icon đỏ; nhãn văn bản rõ | `#b42318` |
| Disabled | Opacity thấp, không chỉ dựa vào màu | theo token bề mặt |

Chế độ Chói nắng và Ban đêm giữ bảng màu chuyên dụng hiện có, nhưng icon vẫn dùng
cùng nét/độ dày và trạng thái hình học ở trên.

### 4.3. Nhãn và khả năng truy cập

- Desktop: tooltip chứa tên và phím tắt.
- Cảm ứng: nhấn giữ hiển thị tên; nút chính có nhãn trực tiếp khi màn hình đủ rộng.
- Mọi button có `aria-label`; các toggle thêm `aria-pressed`; panel thêm
  `aria-expanded` và `aria-controls`.
- Focus ring tương phản cao, không bị lớp nền bản đồ che.

## 5. Wireframe mục tiêu

### Desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ [Chuẩn] [Chói nắng] [Đêm]  [Ranh giới]              [Lớp nền]       │
├──────────────────────────────────────────────────────────────────────┤
│ [•] [╱] [△]  |  [Dữ liệu] [Tìm kiếm] [Lớp] [⋯]                      │
│                                                                      │
│                            BẢN ĐỒ                                    │
│                                                                      │
│                                              [Thẻ đối tượng]         │
└──────────────────────────────────────────────────────────────────────┘
```

### Điện thoại/iPad khi vẽ

```text
┌──────────────────────────────────────────────┐
│ [Vùng] [Bắt điểm] [Lùi] [Tiến] [Xóa] [✓] [×] │
├──────────────────────────────────────────────┤
│                                              │
│                    BẢN ĐỒ                    │
│                                              │
└──────────────────────────────────────────────┘
```

## 6. Kịch bản kiểm thử thiết kế

| Mã | Kịch bản | Kết quả cần đạt |
| --- | --- | --- |
| UX-TOOL-01 | Mở bản đồ, bắt đầu đo điểm/tuyến/vùng | Công cụ chính truy cập trong một lần bấm. |
| UX-TOOL-02 | Vẽ vùng, lùi/tiến/xóa đỉnh/hoàn tất/hủy | Chỉ hành động hợp lệ hiện ra; không nhầm Hủy với Xóa. |
| UX-TOOL-03 | Chọn vùng đã lưu | Thẻ có Thêm/Bớt/Sửa; Bớt không hiện cho tuyến/điểm. |
| UX-TOOL-04 | Mở Dữ liệu/Tìm kiếm/Lớp trên mobile | Không cuộn ngang, drawer vẫn đóng hoàn toàn được. |
| UX-TOOL-05 | Chói nắng, Ban đêm, ảnh vệ tinh | Icon nhận biết được, active/disabled/destructive không chỉ phân biệt bằng màu. |
| UX-TOOL-06 | Bàn phím và screen reader | Phím tắt cũ giữ nguyên, focus/ARIA đúng. |
| UX-TOOL-07 | Build production | Giữ mọi ngân sách raw/gzip đã chốt. |

## 7. Backlog Giai đoạn 1

### P0 — triển khai sau khi duyệt thiết kế

1. Tạo registry SVG nội bộ và thay toàn bộ emoji/icon toolbar-header-sidebar bằng
   bộ icon Field Precision.
2. Đổi toolbar thành hai trạng thái: xem và đang vẽ/sửa.
3. Thêm menu **Thêm** cho công cụ phụ; đưa Kính lúp và Nâng cao vào menu này.
4. Thêm panel **Lớp** gộp chế độ thực địa, ranh giới và bản đồ nền nhưng tái sử dụng
   state/provider hiện có, không tạo nguồn dữ liệu mới.
5. Thêm test unit hợp đồng ARIA/shortcut và E2E desktop + WebKit iPad.

### P1 — chỉ sau khi P0 ổn định

1. Ghi nhớ cục bộ công cụ phụ/kiểu hiển thị người dùng chọn.
2. Nút lặp lại công cụ vừa dùng sau khi lưu; không tự kích hoạt lại nếu có cảnh báo.
3. Filter chip nhanh cho Nháp, Cần xử lý, Đã xác nhận và Thiếu ảnh.
4. Trung tâm trạng thái đồng bộ/offline gọn, chỉ đọc và dẫn tới nháp liên quan.

### Đã loại bỏ khỏi phạm vi

- Hình chữ nhật/Ortho và shortcut `R`/`Shift` liên quan. Chỉ xem xét lại nếu có yêu
  cầu sản phẩm mới được chủ dự án phê duyệt.
- Chọn/xóa/chỉnh sửa hàng loạt vì cần xác định phạm vi quyền, soft-delete, restore
  và audit.
- Bất cứ thay đổi nào tới API, database, công thức hoặc địa giới.

## 8. Tiêu chí hoàn tất Giai đoạn 0

- Có danh mục công cụ thật và quyết định rõ tính năng nào được/không được đưa lên UI.
- Có wireframe desktop/mobile, quy chuẩn icon và trạng thái màu/ARIA.
- Có backlog P0/P1 cùng điều kiện kiểm thử, bundle và rollback.
- Chủ dự án duyệt hướng Field Precision và phạm vi P0 trước khi mã giao diện thay đổi.
