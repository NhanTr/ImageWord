# ImageWord

Ứng dụng chuyển ảnh thành ảnh chữ màu hoặc video chữ in tuần tự, sử dụng Express, React/Vite, PostgreSQL, Redis, MinIO và FFmpeg.

## Yêu cầu

- Docker Engine/Desktop có Docker Compose v2.
- Node.js 22+ và npm 10+ nếu chạy ngoài container.

## Chạy môi trường development

Các giá trị mặc định trong `docker-compose.yml` chỉ dành cho local development:

```bash
docker compose up --build
```

Truy cập:

- Frontend: http://localhost:5173
- Backend readiness: http://localhost:3000/api/v1/health/ready
- MinIO Console: http://localhost:9001

Frontend cung cấp đầy đủ đăng ký/đăng nhập, upload, cấu hình tạo ảnh chữ, preview và thư viện riêng theo tài khoản. Refresh token được giữ trong HttpOnly cookie; frontend không lưu JWT vào localStorage.

Muốn thay đổi credential hoặc port, sao chép `.env.example` thành `.env` và thay giá trị trước khi chạy.

Nếu hostname/public port của MinIO khác `http://localhost:9000`, đặt `MINIO_PUBLIC_ENDPOINT` thành URL mà trình duyệt người dùng truy cập được. Backend dùng giá trị này để tạo presigned URL.

## API ảnh

```text
POST   /api/v1/images          multipart field: file
GET    /api/v1/images          cursor pagination và filter
GET    /api/v1/images/:id      metadata thuộc user hiện tại
GET    /api/v1/images/:id/url  presigned download/preview URL
DELETE /api/v1/images/:id      xóa ảnh và các kết quả liên quan
POST   /api/v1/images/:id/generate  sinh PNG chữ màu từ ảnh upload
POST   /api/v1/images/:id/generate-video  sinh MP4 chữ xuất hiện tuần tự
```

Tất cả endpoint ảnh yêu cầu `Authorization: Bearer <access-token>`.

Ví dụ sinh ảnh chữ màu:

```json
{
  "columns": 120,
  "characterSet": "@%#*+=-:. ",
  "fontFamily": "monospace",
  "backgroundColor": "#000000"
}
```

Roboto Mono được đóng gói dưới dependency `@fontsource/roboto-mono` và chuyển thành vector glyph bằng OpenType, giúp kết quả không phụ thuộc font cài trên host/container.

Ví dụ sinh video chữ màu:

```json
{
  "columns": 80,
  "characterSet": "@%#*+=-:. ",
  "fontFamily": "monospace",
  "backgroundColor": "#000000",
  "durationSeconds": 5
}
```

Docker image backend đã cài FFmpeg. Nếu chạy backend trực tiếp ngoài Docker, cần có lệnh `ffmpeg` trong `PATH` hoặc đặt `FFMPEG_PATH`.

## Kiểm tra source code

```bash
npm install
npm run lint
npm run typecheck
npm run build
npm run format:check
npm test --workspace @imageword/backend
npm test --workspace @imageword/frontend
```

Integration test cần PostgreSQL và Redis đang chạy. Có thể chạy đúng môi trường Compose bằng:

```bash
docker compose exec -T backend npm test --workspace @imageword/backend
```

## Migration

Compose tự chạy migration trước backend. Khi cần chạy lại thủ công:

```bash
docker compose run --rm migrate
```

Migration được theo dõi trong bảng kỹ thuật `schema_migrations`; hai bảng nghiệp vụ là `users` và `images`.

## Production compose

`docker-compose.prod.yml` không có mật khẩu mặc định. Chuẩn bị `.env` với secret thực tế rồi chạy:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Frontend production mặc định ở http://localhost:8080. PostgreSQL, Redis, MinIO và backend không publish port ra host trong cấu hình production.

## Tài liệu

- Kiến trúc: `docs/01-architecture.md`
- Database: `docs/02-database-design.md`
- Kế hoạch có xác nhận: `docs/implementation-plan.md`
- Từng tính năng: `docs/features/`

- test pull