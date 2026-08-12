# Tính năng: Authentication

Trạng thái: `HOÀN THÀNH MỐC 3`

## API đã triển khai

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

## Thiết kế token

- Access JWT: TTL mặc định 15 phút.
- Refresh token: TTL mặc định 7 ngày, chuyển bằng cookie HttpOnly.
- Redis key: `auth:session:{userId}:{jti}`.
- Redis value: SHA-256 hash của refresh token, có TTL bằng refresh token.
- Đăng xuất xóa key; refresh xoay vòng token để hạn chế replay.
- Access JWT chứa `sub`, `sid`, `jti`, `typ=access`, issuer và audience.
- Refresh JWT chứa `sub`, `jti`, `typ=refresh`, issuer và audience.
- Mọi access token chỉ hợp lệ khi session tương ứng còn tồn tại trong Redis.

## Request và response

Đăng ký:

```json
{
  "email": "user@example.com",
  "password": "a-secure-password",
  "displayName": "ImageWord User"
}
```

Đăng nhập chỉ cần `email` và `password`. Đăng ký/đăng nhập/refresh trả `user`, `accessToken`, `tokenType` và `expiresIn`; refresh token chỉ được gửi bằng cookie `imageword_refresh` có `HttpOnly`, `SameSite=Lax` và `Secure` ở production.

## Validation

- Email được trim, chuyển lowercase, kiểm tra đúng định dạng và tối đa 320 ký tự.
- Mật khẩu từ 8 đến 72 ký tự, đồng thời không vượt quá 72 UTF-8 bytes do giới hạn bcrypt.
- Display name được trim, dài 1–100 ký tự.
- Mật khẩu được hash bcrypt cost 12.

## Tiêu chí hoàn thành

- Email không phân biệt hoa thường và không đăng ký trùng.
- Mật khẩu không bao giờ xuất hiện trong log/response/database dạng rõ.
- Refresh hoặc logout thất bại an toàn khi session đã hết hạn.
- User A không thể lấy dữ liệu của user B.

## Kết quả kiểm thử

- Đăng ký và chuẩn hóa email: đạt.
- Từ chối email trùng không phân biệt hoa thường: đạt.
- Login đúng/sai mật khẩu: đạt.
- `/me` yêu cầu access token và trả đúng user từ `sub`: đạt.
- Refresh rotation, từ chối replay token cũ: đạt.
- Access token session cũ bị vô hiệu ngay sau rotation/logout: đạt.
- PostgreSQL chỉ lưu bcrypt hash; Redis chỉ lưu SHA-256 hash có TTL: đạt.
