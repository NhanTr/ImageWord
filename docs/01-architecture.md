# Kiến trúc đề xuất

## Thành phần

| Service      | Vai trò                                 | Dữ liệu bền vững          |
| ------------ | --------------------------------------- | ------------------------- |
| `frontend`   | React/Vite UI                           | Không                     |
| `backend`    | Express API, auth, upload, xử lý ảnh    | Không                     |
| `postgres`   | User và metadata ảnh                    | PostgreSQL volume         |
| `redis`      | Phiên đăng nhập/refresh session         | Redis volume tùy cấu hình |
| `minio`      | File ảnh nguồn và kết quả               | MinIO volume              |
| `minio-init` | Tạo bucket/private policy khi khởi động | Không                     |

## Luồng dữ liệu

### Đăng nhập

1. Frontend gửi email và mật khẩu đến backend.
2. Backend kiểm tra password hash trong PostgreSQL.
3. Backend phát access token ngắn hạn và refresh token có `jti`.
4. Redis lưu session theo `auth:session:<userId>:<jti>` cùng hash refresh token và TTL.
5. Đăng xuất xóa session Redis; refresh token cũ không dùng lại được.

### Upload và chuyển ảnh thành chữ

1. Frontend upload ảnh bằng multipart/form-data đến backend.
2. Backend kiểm tra user, MIME, magic bytes và kích thước.
3. Backend lưu ảnh nguồn vào MinIO, rồi tạo metadata `UPLOADED` trong PostgreSQL.
4. Backend lấy mẫu ảnh thành lưới ký tự, tính màu và ký tự theo độ sáng.
5. Backend render lưới chữ thành SVG rồi chuyển sang PNG.
6. PNG kết quả được lưu MinIO và metadata `GENERATED` được tạo với `parent_image_id`.
7. API trả metadata và presigned URL có thời hạn.

## Object key MinIO

Không sử dụng tên file gốc làm object key:

```text
users/{userId}/uploads/{imageId}/source.{ext}
users/{userId}/generated/{imageId}/colored-text.png
```

Bucket mặc định: `imageword`, private hoàn toàn.

## Biên bảo mật

- Access token: JWT sống ngắn, gửi qua `Authorization: Bearer`.
- Refresh token: ưu tiên cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Redis giữ hash refresh token/session, đáp ứng yêu cầu cache JWT mà giảm rủi ro lộ token.
- Mọi truy vấn ảnh đều lọc cả `image.id` và `user_id`.
- Presigned URL có TTL ngắn; không public bucket.
