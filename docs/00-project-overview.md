# Tổng quan ImageWord

## Phạm vi MVP

1. Người dùng đăng ký, đăng nhập, làm mới token và đăng xuất.
2. Người dùng tải ảnh JPEG, PNG hoặc WebP lên.
3. Ảnh nguồn được lưu private trong MinIO; PostgreSQL chỉ lưu metadata.
4. Backend thu nhỏ ảnh thành lưới, ánh xạ độ sáng sang ký tự và tô mỗi ký tự bằng màu pixel tương ứng.
5. Backend render kết quả thành PNG và lưu lại MinIO.
6. Người dùng xem danh sách, xem chi tiết và xóa ảnh thuộc tài khoản của mình.
7. Toàn bộ frontend, backend, PostgreSQL, Redis và MinIO chạy bằng Docker Compose.

## Ngoài phạm vi MVP

- Đăng nhập OAuth/social.
- Chia sẻ ảnh công khai.
- Thanh toán hoặc quota nhiều gói.
- Xử lý phân tán bằng message queue/worker riêng.
- Chỉnh sửa ảnh nâng cao.

## Giả định để thiết kế

- Kết quả chính là một file PNG nhìn giống ảnh gốc nhưng được cấu thành từ các ký tự màu.
- Lần đầu xử lý đồng bộ trong request với giới hạn kích thước an toàn. Worker nền có thể thêm sau nếu thời gian xử lý thực tế quá dài.
- Mỗi lần sinh kết quả tạo một record ảnh mới, không ghi đè ảnh nguồn.

Các giả định này phải được xác nhận ở Mốc 1 trước khi viết mã nghiệp vụ.
