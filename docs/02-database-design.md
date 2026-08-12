# Thiết kế PostgreSQL

PostgreSQL chỉ có hai bảng nghiệp vụ: `users` và `images`.

## Enum

```sql
CREATE TYPE image_kind AS ENUM ('UPLOADED', 'GENERATED');
CREATE TYPE image_status AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');
```

## Bảng `users`

| Cột             | Kiểu         | Ràng buộc / ý nghĩa                            |
| --------------- | ------------ | ---------------------------------------------- |
| `id`            | UUID         | PK, sinh bởi ứng dụng hoặc `gen_random_uuid()` |
| `email`         | VARCHAR(320) | NOT NULL, unique theo chữ thường               |
| `password_hash` | TEXT         | NOT NULL, Argon2id hoặc bcrypt                 |
| `display_name`  | VARCHAR(100) | NOT NULL                                       |
| `created_at`    | TIMESTAMPTZ  | NOT NULL, default now                          |
| `updated_at`    | TIMESTAMPTZ  | NOT NULL, default now                          |

Chỉ lưu `password_hash`, tuyệt đối không lưu mật khẩu rõ.

## Bảng `images`

| Cột               | Kiểu         | Ràng buộc / ý nghĩa                                 |
| ----------------- | ------------ | --------------------------------------------------- |
| `id`              | UUID         | PK                                                  |
| `user_id`         | UUID         | FK users, NOT NULL, ON DELETE CASCADE               |
| `parent_image_id` | UUID         | FK images, nullable; chỉ ảnh GENERATED sử dụng      |
| `kind`            | image_kind   | UPLOADED hoặc GENERATED                             |
| `status`          | image_status | Trạng thái xử lý                                    |
| `original_name`   | VARCHAR(255) | Tên hiển thị đã sanitize; ảnh generated có thể null |
| `object_key`      | TEXT         | NOT NULL, unique; key trong MinIO                   |
| `bucket`          | VARCHAR(63)  | NOT NULL                                            |
| `mime_type`       | VARCHAR(100) | NOT NULL                                            |
| `size_bytes`      | BIGINT       | NOT NULL, >= 0                                      |
| `width`           | INTEGER      | Nullable khi chưa READY, > 0 nếu có                 |
| `height`          | INTEGER      | Nullable khi chưa READY, > 0 nếu có                 |
| `settings`        | JSONB        | Tham số sinh ảnh chữ; `{}` cho ảnh nguồn            |
| `error_message`   | TEXT         | Lỗi xử lý nội bộ đã làm sạch, nullable              |
| `created_at`      | TIMESTAMPTZ  | NOT NULL, default now                               |
| `updated_at`      | TIMESTAMPTZ  | NOT NULL, default now                               |

## Ràng buộc quan trọng

```sql
CHECK (
  (kind = 'UPLOADED' AND parent_image_id IS NULL)
  OR
  (kind = 'GENERATED' AND parent_image_id IS NOT NULL)
);
```

Ở tầng service, ảnh cha phải cùng `user_id` và có `kind = 'UPLOADED'`.

## Index

```sql
CREATE UNIQUE INDEX users_email_lower_uidx ON users (lower(email));
CREATE INDEX images_user_created_idx ON images (user_id, created_at DESC);
CREATE INDEX images_parent_idx ON images (parent_image_id);
CREATE INDEX images_user_kind_status_idx ON images (user_id, kind, status);
```

## Quan hệ

```text
users 1 ─────── N images
                    │
                    └── parent_image_id ──> images.id
```

Một user có nhiều ảnh; một ảnh upload có thể có nhiều phiên bản ảnh chữ.

## Những gì không lưu trong PostgreSQL

- Binary ảnh.
- Access token hoặc refresh token.
- Session đăng nhập.
- Presigned URL vì URL hết hạn và phải sinh theo yêu cầu.

## Migration

- Migration nguồn: `backend/migrations/001_initial_schema.sql`.
- `schema_migrations` là bảng kỹ thuật để theo dõi migration, không phải bảng nghiệp vụ.
- Migration chạy dưới PostgreSQL advisory lock, mỗi file chạy trong transaction và có thể gọi lặp an toàn.
- Compose chạy service `migrate` sau khi PostgreSQL healthy và trước backend.
