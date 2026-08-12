# Tính năng: Chuyển ảnh thành chữ màu

Trạng thái: `CHỜ DUYỆT`

## API dự kiến

- `POST /api/v1/images/:id/generate`

Payload dự kiến:

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
3. Resize thành lưới `columns × rows`.
4. Tính luminance mỗi cell để chọn ký tự từ đậm đến nhạt.
5. Lấy RGB của cell để tô ký tự.
6. Render SVG bằng font monospace an toàn, rồi xuất PNG.
7. Lưu PNG vào MinIO và record GENERATED vào PostgreSQL.

## Giới hạn an toàn dự kiến

- `columns`: 20–300.
- Character set phải nằm trong tập ký tự cho phép hoặc được escape khi render SVG.
- Giới hạn tổng số glyph để tránh quá tải CPU/RAM.

## Tiêu chí hoàn thành

- Màu ký tự phản ánh vùng pixel tương ứng.
- Tỷ lệ ảnh kết quả không bị méo đáng kể.
- Cùng input/settings tạo kết quả ổn định.
- Lỗi xử lý chuyển trạng thái FAILED và không để object mồ côi.
