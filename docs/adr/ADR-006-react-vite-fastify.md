# ADR-006: React/Vite cho PWA và Fastify cho API

- Trạng thái: Accepted
- Ngày: 18/07/2026

## Bối cảnh

Ứng dụng cần PWA responsive và modular monolith có validation/OpenAPI tốt.

## Quyết định

Dùng React 19 với Vite 8 cho web và Fastify 5 cho API. Route Fastify khai báo JSON
Schema dùng TypeBox. Mỗi mô-đun nghiệp vụ về sau là plugin có service/repository công
khai; giao diện không gọi trực tiếp nhà cung cấp bản đồ hoặc định tuyến.

Mốc 0 chỉ tạo web shell, manifest và endpoint health. Service worker, IndexedDB,
MapLibre và chức năng nghiệp vụ thuộc các mốc sau.

## Hệ quả

Schema runtime có thể sinh OpenAPI và kiểm tra đầu vào. Manifest hiện chưa biến web
shell thành ứng dụng ngoại tuyến; đó là chủ ý để không lấn sang Mốc 4.
