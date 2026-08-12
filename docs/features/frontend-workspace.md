# Tính năng: Frontend workspace

Trạng thái: `HOÀN THÀNH MỐC 6`

## Luồng tài khoản

- Màn hình khách có hai chế độ đăng nhập và đăng ký, validation HTML phù hợp với API.
- Access JWT chỉ nằm trong memory của module API, không dùng localStorage/sessionStorage.
- Khi ứng dụng khởi động, frontend gọi `POST /auth/refresh` để khôi phục phiên bằng HttpOnly cookie.
- Khi request được bảo vệ trả 401, các request dùng chung một refresh promise rồi retry đúng một lần.
- Đăng xuất gọi backend để xóa Redis session/cookie và luôn xóa access token phía client.
- Workspace chỉ render khi phiên đã được xác thực.

## Luồng tạo ảnh

1. Người dùng chọn hoặc kéo thả JPEG/PNG/WebP tối đa 10 MB.
2. Frontend kiểm tra sớm MIME/dung lượng và hiển thị local preview.
3. Sau upload thành công, ảnh đó tự được chọn làm nguồn.
4. Form generation cho phép chỉnh 20–300 cột, bộ ký tự printable ASCII và màu nền hex.
5. Kết quả READY được tải lại vào gallery; lỗi generation được trình bày trong thông báo và record FAILED vẫn có thể xuất hiện.

## UI và khả năng sử dụng

- Layout responsive cho desktop, tablet và mobile.
- Có nhãn form, tab semantics, live status, empty/loading/error state và reduced-motion support.
- Preview lấy từ MinIO private thông qua presigned URL do API cấp.
- Download mở URL có thời hạn; delete có xác nhận và cảnh báo cascade cho ảnh nguồn.

## Kiểm thử tự động

- `api.test.ts`: access token hết hạn được refresh một lần và request được retry bằng token mới.
- `App.test.tsx`: từ phiên khách, người dùng chuyển sang đăng ký và vào được workspace/gallery.
- Luồng API thật đã được kiểm tra: register → upload → generate → signed URL → list → cascade delete → logout.

Kiểm thử điều khiển UI trực tiếp bằng browser chưa chạy được trong phiên Mốc 6 vì không có browser nào kết nối với công cụ kiểm thử. Đây là hạng mục cần chạy lại ở Mốc 7; source tests, production build và API E2E đều đã đạt.
