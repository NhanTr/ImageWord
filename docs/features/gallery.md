# Tính năng: Thư viện ảnh người dùng

Trạng thái: `CHỜ DUYỆT`

## Phạm vi

- Hiển thị ảnh upload và kết quả theo tài khoản hiện tại.
- Lọc theo loại/trạng thái.
- Xem quan hệ giữa ảnh nguồn và các kết quả.
- Preview bằng presigned URL và tải PNG kết quả.
- Xóa ảnh với thông báo rõ phạm vi cascade.

## Tiêu chí hoàn thành

- Không lộ object key hoặc dữ liệu của tài khoản khác ngoài metadata cần thiết.
- URL hết hạn có thể được cấp lại mà không reload toàn bộ ứng dụng.
- UI thể hiện loading, empty state và error state.
