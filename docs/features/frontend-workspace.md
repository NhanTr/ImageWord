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

### Cải thiện khả năng đọc (nhánh `feature-ui-readability-improvements`)

- Thu gọn hero workspace, thêm CTA và minh họa chữ màu để nội dung chính rõ hơn ngay khi mở trang.
- Thêm thanh quy trình `Tải ảnh → Tùy chỉnh → Nhận kết quả`, liên kết trực tiếp đến từng vùng thao tác.
- Tăng độ tương phản chữ phụ, viền và focus ring; tăng kích thước vùng bấm của nút trong gallery.
- Upload, generator, empty state và image card dùng cùng hệ card, khoảng cách và bo góc để dễ quét nội dung.
- Gallery dùng lưới tự thích nghi theo chiều rộng và hiển thị số mục của trang hiện tại.
- Tab loại kết quả và bộ lọc gallery khai báo `aria-pressed` theo trạng thái thực tế.

## Kiểm thử tự động

- `api.test.ts`: access token hết hạn được refresh một lần và request được retry bằng token mới.
- `App.test.tsx`: từ phiên khách, người dùng chuyển sang đăng ký và vào được workspace/gallery.
- Luồng API thật đã được kiểm tra: register → upload → generate → signed URL → list → cascade delete → logout.
- Sau đợt cải thiện UI: frontend test, typecheck và production build đều đạt; màn hình đăng nhập desktop/mobile đã được render kiểm tra và mobile không tràn ngang.

Trong phiên Mốc 6 ban đầu chưa có browser kết nối. Ở đợt cải thiện UI này đã kiểm tra trực quan màn hình đăng nhập trên desktop/mobile; kiểm thử browser toàn bộ workspace có backend thật vẫn là hạng mục của Mốc 7. Source tests, production build và API E2E hiện có đều đã đạt.
