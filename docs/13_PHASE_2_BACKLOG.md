# 13. Backlog giai đoạn 2

## Ưu tiên P1

- [x] Import GeoJSON có preview/schema/giới hạn kích thước và audit đầy đủ (ADR-021).
- [x] Sao chép cấu trúc hồ sơ (ADR-020), phục hồi bản ghi xóa mềm và conflict UI chi
  tiết (ADR-021).
- [x] Pagination/bbox server-side và trì hoãn render danh sách ngoài viewport
  (ADR-021).
- [x] Queued export, artifact trong object storage và tải xuống có quyền (ADR-021).
- [x] Quét malware, thumbnail pipeline và lifecycle/versioning object storage
  (ADR-021).

## Ưu tiên P2

- RBAC nhiều người dùng, reviewer comment và phê duyệt điện tử.
- OSRM/Valhalla tự host, cache route được phép và dashboard quota/provider health.
- KML/GPX, PDF/Word và mẫu biên bản theo cấu hình cơ quan.
- Giám sát/alert tập trung, OpenTelemetry và lịch backup ngoài máy chủ ứng dụng.

## Điều kiện đưa vào kế hoạch

Mỗi hạng mục phải có người dùng/ca thực tế, dữ liệu mẫu, tiêu chí nghiệm thu, tác
động bảo toàn chứng cứ và migration/rollback plan. Không đưa AI vào phép tính cốt
lõi hoặc tự động kết luận sai phạm.
