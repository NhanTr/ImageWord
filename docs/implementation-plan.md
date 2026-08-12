# Kế hoạch triển khai có xác nhận

Mỗi mốc chỉ bắt đầu sau khi người dùng xác nhận.

## Mốc 1 — Duyệt yêu cầu và thiết kế

Trạng thái: `HOÀN THÀNH` — người dùng xác nhận ngày 2026-08-12.

- Xác nhận đầu ra là PNG tạo bởi các ký tự màu.
- Xác nhận giới hạn upload mặc định 10 MB và định dạng JPEG/PNG/WebP.
- Xác nhận access JWT + refresh token/session trong Redis.
- Duyệt schema hai bảng `users` và `images`.
- Duyệt API và cấu trúc service.

Kết quả: tài liệu kiến trúc được chốt, chưa có code ứng dụng.

## Mốc 2 — Khởi tạo monorepo và Docker Compose

Trạng thái: `HOÀN THÀNH` — người dùng xác nhận ngày 2026-08-12.

- Tạo `backend/`, `frontend/`, cấu hình TypeScript và lint/format.
- Viết Dockerfile dev/prod phù hợp.
- Viết `docker-compose.yml` cho frontend, backend, postgres, redis, minio, minio-init.
- Viết `.env.example`, healthcheck và volumes.
- Kiểm tra toàn bộ service khởi động và liên lạc được.

## Mốc 3 — Database và authentication

Trạng thái: `HOÀN THÀNH` — người dùng xác nhận ngày 2026-08-12.

- Tạo migration/schema cho `users`, `images` và enum.
- API đăng ký, đăng nhập, refresh, đăng xuất, lấy profile.
- Hash mật khẩu; lưu session/refresh-token hash có TTL trong Redis.
- Middleware xác thực và test cho ownership/auth cases.

## Mốc 4 — Upload và quản lý file MinIO

Trạng thái: `HOÀN THÀNH` — chờ người dùng nghiệm thu để chuyển sang Mốc 5.

- Upload có validation kích thước, MIME và magic bytes.
- Lưu object private trong MinIO và metadata PostgreSQL.
- API danh sách, chi tiết, presigned URL và xóa ảnh của chính user.
- Xử lý rollback/cleanup khi MinIO hoặc database lỗi giữa chừng.

## Mốc 5 — Bộ xử lý ảnh thành chữ màu

Trạng thái: `CHỜ DUYỆT`.

- Resize/lấy mẫu ảnh theo số cột.
- Ánh xạ luminance sang character ramp.
- Dùng màu RGB trung bình của cell cho ký tự tương ứng.
- Render SVG an toàn, chuyển thành PNG, lưu MinIO.
- Lưu record GENERATED liên kết ảnh nguồn và test thuật toán.

## Mốc 6 — Frontend Vite

Trạng thái: `CHỜ DUYỆT`.

- Trang đăng ký/đăng nhập.
- Trang upload và lựa chọn thông số sinh ảnh.
- Preview, trạng thái xử lý, thư viện ảnh và tải kết quả.
- Route bảo vệ, refresh session và xử lý lỗi dễ hiểu.

## Mốc 7 — Hoàn thiện và kiểm thử end-to-end

Trạng thái: `CHỜ DUYỆT`.

- Test auth, phân quyền chéo user, upload lỗi và chuyển ảnh.
- Kiểm tra restart container không mất PostgreSQL/MinIO data.
- Kiểm tra security headers, CORS, rate limit và secret handling.
- Hoàn thiện README chạy local và production notes.

## Cách xác nhận

Phản hồi theo mẫu: `Xác nhận Mốc 1` hoặc nêu thay đổi cần sửa trong thiết kế. Sau mỗi mốc, hệ thống sẽ báo file đã thay đổi, kết quả kiểm thử và xin duyệt mốc kế tiếp.
