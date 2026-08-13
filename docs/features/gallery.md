# Tính năng: Thư viện ảnh người dùng

Trạng thái: `HOÀN THÀNH MỐC 6`

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

## Hiện thực frontend

- Gallery dùng cursor pagination, lọc `ALL`, `UPLOADED` hoặc `GENERATED`.
- Mỗi preview xin presigned URL tại thời điểm render; URL/object key không được lưu trong state dùng lâu dài.
- Card ảnh gốc cho phép chọn làm nguồn generation và hiển thị số kết quả đang có trong trang.
- Card kết quả cho phép tải/mở file qua URL có thời hạn.
- Xóa ảnh gốc yêu cầu xác nhận riêng và cảnh báo rõ về cascade kết quả.
- Có loading, empty, failed và lỗi kết nối ở cả gallery lẫn từng preview.

## Kiểm thử

```bash
npm run test --workspace @imageword/frontend
npm run typecheck --workspace @imageword/frontend
npm run build --workspace @imageword/frontend
```
