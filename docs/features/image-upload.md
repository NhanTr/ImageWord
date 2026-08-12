# Tính năng: Upload và lưu ảnh

Trạng thái: `HOÀN THÀNH MỐC 4`

## API đã triển khai

- `POST /api/v1/images`
- `GET /api/v1/images`
- `GET /api/v1/images/:id`
- `GET /api/v1/images/:id/url`
- `DELETE /api/v1/images/:id`

## Quy tắc mặc định

- Định dạng: JPEG, PNG, WebP.
- Kích thước tối đa: 10 MB.
- Không dùng tên file client làm object key.
- Bucket private; download/preview qua presigned URL ngắn hạn.
- Khi xóa ảnh nguồn, xóa các ảnh GENERATED liên quan và object tương ứng.
- `POST /images` nhận `multipart/form-data` với field duy nhất tên `file`.
- Presigned URL có TTL mặc định 300 giây.
- Giới hạn giải mã mặc định 40 triệu pixel để giảm rủi ro decompression bomb.

## List query

`GET /api/v1/images` hỗ trợ:

- `limit`: 1–100, mặc định 20.
- `kind`: `UPLOADED` hoặc `GENERATED`.
- `status`: `PENDING`, `PROCESSING`, `READY` hoặc `FAILED`.
- `cursor`: opaque base64url cursor từ `nextCursor` của trang trước.

Thứ tự ổn định là `created_at DESC, id DESC`.

## Quy tắc lưu trữ

- Object key ảnh nguồn: `users/{userId}/uploads/{imageId}/source.{ext}`.
- Phần mở rộng và MIME lấy từ magic bytes, không lấy từ tên client.
- Tên client chỉ được sanitize và lưu ở `original_name` để hiển thị.
- API public không trả `bucket` hoặc `object_key`.
- Backend dùng endpoint MinIO nội bộ để upload/delete và endpoint public riêng để ký URL trình duyệt.

## Tiêu chí hoàn thành

- MIME khai báo phải khớp nội dung file.
- Upload lỗi không để lại record/object mồ côi.
- Pagination ổn định theo `created_at` và `id`.
- Mọi endpoint kiểm tra ownership.

## Kết quả kiểm thử

- Yêu cầu access token: đạt.
- Thiếu file, file giả, MIME mismatch, file trên 10 MB: bị từ chối đúng mã lỗi.
- JPEG/PNG/WebP được nhận diện theo nội dung; metadata kích thước lấy bằng Sharp.
- Object không truy cập anonymous được: đạt, HTTP 403.
- Upload trả metadata nhưng không lộ object key: đạt.
- Pagination cursor, filter và invalid cursor: đạt.
- User B không list/read/get URL/delete ảnh của user A: đạt.
- Presigned URL dùng public endpoint và có chữ ký/TTL: đạt.
- Xóa ảnh nguồn cascade metadata và MinIO object của ảnh GENERATED: đạt.
- Nếu insert PostgreSQL thất bại sau upload, service cố gắng xóa object vừa tạo.
