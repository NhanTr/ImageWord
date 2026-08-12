# Mốc 2 — Foundation và Docker

Trạng thái: `HOÀN THÀNH`, chờ người dùng nghiệm thu.

## Thay đổi chính

- Tạo npm monorepo gồm `backend` và `frontend`.
- Bật TypeScript strict mode, ESLint và Prettier ở root.
- Tạo Express API tối thiểu với liveness/readiness endpoint và graceful shutdown.
- Tạo React/Vite shell kiểm tra readiness của backend.
- Kết nối nền với PostgreSQL, Redis và MinIO.
- Tạo development/production Dockerfile cho cả hai ứng dụng.
- Tạo Compose development và production cho toàn bộ hệ thống.
- Tạo `.env.example`, `.dockerignore`, `.gitignore` và hướng dẫn chạy trong README.

## Endpoint hiện có

- `GET /api/v1`
- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`

Authentication và ảnh chưa được triển khai trong mốc này.

## Xác minh đã chạy

```text
npm run lint              PASS
npm run typecheck         PASS
npm run build             PASS
npm run format:check      PASS
docker compose config     PASS
development stack         PASS
production image build    PASS
```

## Cách chạy

```bash
docker compose up --build -d
```

Các địa chỉ development:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000/api/v1`
- MinIO Console: `http://localhost:9001`
