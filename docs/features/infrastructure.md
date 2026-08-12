# Tính năng: Docker Compose và hạ tầng local

Trạng thái: `HOÀN THÀNH MỐC 2`

## Service dự kiến

- `frontend`: Vite dev server hoặc static build qua Nginx ở profile production.
- `backend`: Express API.
- `postgres`: PostgreSQL với named volume và healthcheck.
- `redis`: Redis với healthcheck và named volume nếu bật persistence.
- `minio`: S3-compatible storage với named volume và healthcheck.
- `minio-init`: tạo bucket `imageword`, sau đó kết thúc thành công.

## Cổng local dự kiến

| Service       | Port |
| ------------- | ---- |
| Frontend      | 5173 |
| Backend       | 3000 |
| PostgreSQL    | 5432 |
| Redis         | 6379 |
| MinIO API     | 9000 |
| MinIO Console | 9001 |

## Tiêu chí hoàn thành

- `docker compose up --build` khởi động đầy đủ từ máy sạch.
- Backend chỉ ready sau khi PostgreSQL, Redis và MinIO healthy.
- Dữ liệu PostgreSQL và MinIO tồn tại sau restart.
- Tất cả secret nằm trong environment; repo chỉ có placeholder trong `.env.example`.

## Hiện thực ngày 2026-08-12

- `docker-compose.yml` cung cấp môi trường development với hot reload cho Express và Vite.
- `docker-compose.prod.yml` dùng production build, Nginx phục vụ frontend và không publish các service nội bộ.
- Backend và frontend đều có multi-stage Dockerfile cho development/production.
- `minio-init` chờ DNS/API MinIO, tạo bucket idempotent và đặt bucket ở chế độ private.
- PostgreSQL, Redis, MinIO và backend có healthcheck; dependency chain dùng health/completion condition.
- Named volumes giữ dữ liệu PostgreSQL, Redis và MinIO; dependency được đóng gói trong image.

## Kết quả kiểm tra

- `docker compose config --quiet`: đạt.
- Production Compose parse với `.env.example`: đạt.
- `docker compose up --build -d`: toàn bộ stack khởi động thành công.
- Backend liveness: `{"status":"ok"}`.
- Backend readiness: xác nhận PostgreSQL, Redis và MinIO sẵn sàng.
- Frontend Vite trả HTML trên cổng 5173.
- Bucket `imageword` được tạo và đặt private.
- Production Docker stages của backend và frontend build thành công.
