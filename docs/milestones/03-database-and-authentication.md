# Mốc 3 — Database và Authentication

Trạng thái: `HOÀN THÀNH`, chờ người dùng nghiệm thu.

## Thay đổi chính

- Tạo SQL migration cho enum, `users`, `images`, constraints, indexes và trigger `updated_at`.
- Tạo migration runner tuần tự, transaction-safe và có advisory lock.
- Thêm service `migrate` vào Compose development/production trước backend.
- Triển khai register, login, refresh rotation, logout và profile.
- Hash mật khẩu bằng bcrypt cost 12.
- Ký access/refresh JWT HS256 với issuer, audience, type và TTL riêng.
- Lưu SHA-256 refresh-token hash trong Redis theo session `jti`.
- Middleware access kiểm tra JWT và sự tồn tại của session trong Redis.
- Chuẩn hóa validation và error response.

## API

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

## Xác minh đã chạy

```text
npm run lint                            PASS
npm run typecheck                       PASS
npm run build                           PASS
npm run format:check                    PASS
docker compose config                   PASS
initial migration                       PASS
idempotent migration rerun              PASS
auth integration tests: 2/2             PASS
production backend/migrate image build  PASS
```

Integration test bao phủ email normalization/duplicate, password failure, cookie, Redis hash/TTL, access middleware, refresh rotation/replay, logout revocation và hai user có identity tách biệt.
