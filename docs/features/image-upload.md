# Tính năng: Upload và lưu ảnh

Trạng thái: `CHỜ DUYỆT`

## API dự kiến

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

## Tiêu chí hoàn thành

- MIME khai báo phải khớp nội dung file.
- Upload lỗi không để lại record/object mồ côi.
- Pagination ổn định theo `created_at` và `id`.
- Mọi endpoint kiểm tra ownership.
