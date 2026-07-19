# ADR-021: Pipeline dữ liệu P1 giai đoạn 2

- Trạng thái: Accepted
- Ngày: 19/07/2026

## Bối cảnh

Các P1 còn lại cùng tác động tới dữ liệu lớn, thao tác phục hồi và object storage.
Giữ export đồng bộ trong request, nhận GeoJSON không preview hoặc đánh dấu ảnh hoàn
tất trước khi quét đều tạo rủi ro mất truy vết và cạn tài nguyên.

## Quyết định

- Import phép đo dùng hai bước preview/commit. Máy chủ giới hạn 5 MB, 1.000 feature,
  kiểm schema thuộc tính và geometry; commit kiểm lại SHA-256 rồi tạo toàn bộ phép đo
  trong một transaction với `method=import_geojson` và một import batch có audit.
- API danh sách dùng cursor xác định `(updated_at,id)` đã chuẩn hóa tới mili giây và
  measurement hỗ trợ bbox EPSG:4326. Client phân trang theo cửa sổ 200 bản ghi và
  trì hoãn render phần tử ngoài viewport bằng `content-visibility`.
- Phục hồi hồ sơ/phép đo/ảnh là mutation có lý do, kiểm owner/trạng thái khóa và ghi
  audit. Không khôi phục dây chuyền ngầm các bản ghi con.
- Export job được ghi `pending` cùng snapshot, xử lý ngoài request, lưu artifact dưới
  prefix `exports/` và tải qua API có kiểm quyền. Endpoint đồng bộ cũ được giữ trong
  một chu kỳ tương thích nhưng UI chuyển sang job queue. Khi khởi động, worker nhận
  lại job pending và đưa job processing quá 15 phút về pending trước khi claim lại.
- Ảnh mới chỉ `completed` sau khi xác minh byte/hash, ClamAV trả `clean` và thumbnail
  được tạo từ bản sao. Scanner lỗi hoặc không sẵn sàng làm completion fail-closed;
  tệp nhiễm được đánh dấu nhưng bản gốc vẫn giữ để điều tra, không được liệt kê làm
  bằng chứng hợp lệ.
- MinIO local bật versioning. Chỉ artifact `exports/` có lifecycle hết hạn 90 ngày;
  DB vẫn giữ export event, snapshot và hash. Bằng chứng gốc/thumbnail không tự hết hạn.

## Hệ quả

Migration P1 có rollback guard khi đã có import, artifact queue hoặc kết quả scan.
ClamAV trở thành dependency readiness cho hoàn tất upload nhưng không chặn các chức
năng không dùng tệp. Các attachment đã hoàn tất trước migration mang trạng thái
`not_scanned_legacy`, không được mô tả sai là đã quét; vận hành phải lập kế hoạch quét
lại nếu chúng được dùng ngoài dữ liệu local/test.

SHA-256 import được tính trên biểu diễn JSON mà API nhận sau khi parse/serialize; đây
không phải hash byte nguyên thủy của tệp trình duyệt. `sourceName`, schema, số feature,
kích thước payload và hash vẫn được lưu cùng batch để chống commit khác bản preview.
