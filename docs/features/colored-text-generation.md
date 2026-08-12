# Tính năng: Chuyển ảnh thành chữ màu

Trạng thái: `HOÀN THÀNH MỐC 5`

## API đã triển khai

- `POST /api/v1/images/:id/generate`

Payload; mọi trường đều có default nên body `{}` cũng hợp lệ:

```json
{
  "columns": 120,
  "characterSet": "@%#*+=-:. ",
  "fontFamily": "monospace",
  "backgroundColor": "#000000"
}
```

## Thuật toán MVP

1. Đọc ảnh nguồn từ MinIO và normalize orientation.
2. Tính số hàng theo tỷ lệ ảnh và tỷ lệ rộng/cao của glyph monospace.
3. Composite alpha lên `backgroundColor`, resize thành lưới `columns × rows`.
4. Tính luminance mỗi cell để chọn ký tự từ đậm đến nhạt.
5. Lấy RGB của cell để tô ký tự.
6. Parse Roboto Mono đóng gói bằng OpenType, định nghĩa vector path cho từng glyph và dùng SVG `<use>` để tô màu từng cell.
7. Lưu PNG vào MinIO và record GENERATED vào PostgreSQL.

Không dùng font hệ điều hành hoặc SVG `<text>`. Vì vậy output không phụ thuộc Fontconfig và ký tự client không thể trở thành markup SVG.

## Giới hạn an toàn dự kiến

- `columns`: 20–300, mặc định 120.
- `characterSet`: 2–32 ký tự ASCII printable, mặc định `@%#*+=-:. `.
- `fontFamily`: MVP chỉ chấp nhận literal `monospace`; hình dạng thực tế là Roboto Mono được đóng gói.
- `backgroundColor`: định dạng `#RRGGBB`, mặc định đen.
- Tổng glyph tối đa mặc định 50.000, cấu hình qua `GENERATION_MAX_GLYPHS`.
- Cell cố định 8×16 pixel; số hàng có hiệu chỉnh aspect ratio cell để output không méo.

## Lifecycle

1. Kiểm tra source thuộc user, là `UPLOADED/READY`.
2. Tạo record `GENERATED/PENDING` với object key server sinh.
3. Đọc source, render PNG và lưu MinIO.
4. Thành công: cập nhật record `READY`, kích thước và dung lượng.
5. Thất bại: xóa output nếu đã ghi, cập nhật record `FAILED` với thông báo đã làm sạch.

## Tiêu chí hoàn thành

- Màu ký tự phản ánh vùng pixel tương ứng.
- Tỷ lệ ảnh kết quả không bị méo đáng kể.
- Cùng input/settings tạo kết quả ổn định.
- Lỗi xử lý chuyển trạng thái FAILED và không để object mồ côi.

## Kết quả kiểm thử

- Grid giữ đúng tỷ lệ với cell monospace 8×16: đạt.
- Luminance ánh xạ ramp từ ký tự đậm sang nhạt: đạt.
- RGB của cell xuất hiện đúng trong fill của vector glyph: đạt.
- Ký tự được chuyển thành vector path, không chèn text/markup client vào SVG: đạt.
- Cùng source/settings tạo PNG byte-identical: đạt.
- User khác generate source nhận 404: đạt.
- GENERATED không được dùng làm source: đạt, HTTP 409.
- PNG private trên MinIO liên kết đúng `parent_image_id`: đạt.
- Source bị thiếu tạo record FAILED và không có output object: đạt.
- Xóa source cascade record/object GENERATED: đạt.
