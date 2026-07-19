# 13. Backlog giai đoạn 2

## Ưu tiên P1

- Import GeoJSON có preview/schema/giới hạn kích thước và audit đầy đủ.
- Sao chép cấu trúc hồ sơ (đã hoàn thành theo ADR-020); phục hồi bản ghi xóa mềm và
  conflict UI chi tiết còn lại.
- Pagination/bbox server-side cho hồ sơ vượt 5.000 geometry và virtualized list.
- Streaming/queued export, lưu artifact trong object storage và tải xuống có quyền.
- Quét malware, thumbnail pipeline và lifecycle/versioning object storage.

## Ưu tiên P2

- RBAC nhiều người dùng, reviewer comment và phê duyệt điện tử.
- OSRM/Valhalla tự host, cache route được phép và dashboard quota/provider health.
- KML/GPX, PDF/Word và mẫu biên bản theo cấu hình cơ quan.
- Giám sát/alert tập trung, OpenTelemetry và lịch backup ngoài máy chủ ứng dụng.

## Điều kiện đưa vào kế hoạch

Mỗi hạng mục phải có người dùng/ca thực tế, dữ liệu mẫu, tiêu chí nghiệm thu, tác
động bảo toàn chứng cứ và migration/rollback plan. Không đưa AI vào phép tính cốt
lõi hoặc tự động kết luận sai phạm.
