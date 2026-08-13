# Mốc 5 — Chuyển ảnh thành chữ màu

Trạng thái: `HOÀN THÀNH`, chờ người dùng nghiệm thu.

## Thay đổi chính

- Thêm `POST /api/v1/images/:id/generate` với validation settings và ownership.
- Tạo lifecycle GENERATED `PENDING → READY/FAILED` trong bảng `images` hiện có.
- Đọc source private từ MinIO và normalize EXIF orientation bằng Sharp.
- Tính grid có hiệu chỉnh tỷ lệ cell monospace 8×16.
- Lấy mẫu RGB, tính luminance và ánh xạ character ramp.
- Đóng gói Roboto Mono, parse bằng OpenType và render glyph thành reusable SVG vector paths.
- Chuyển SVG sang PNG bằng Sharp, lưu private trên MinIO và liên kết `parent_image_id`.
- Dọn object đầu ra và ghi FAILED khi generation lỗi.

## Giới hạn

```text
columns         20–300
characterSet    2–32 printable ASCII characters
fontFamily      monospace
max glyphs      50,000 (configurable)
output          PNG only
```

## Xác minh đã chạy

```text
npm run lint                         PASS
npm run typecheck                    PASS
npm run build                        PASS
npm run format:check                 PASS
all backend tests                    11/11 PASS
algorithm/unit tests                 5/5 PASS
generation integration tests         2/2 PASS
deterministic PNG bytes               PASS
production generator runtime          PASS
cross-user ownership                  PASS
FAILED lifecycle / no orphan output  PASS
source cascade delete                 PASS
```

## Quyết định kỹ thuật

Không sử dụng SVG `<text>` hoặc font hệ điều hành. Thử nghiệm ban đầu cho thấy librsvg/Fontconfig trong Alpine có thể tải font bất đồng bộ và tạo PNG khác nhau giữa các lần render. Vector glyph từ font đóng gói loại bỏ sự phụ thuộc này, ngăn character set trở thành markup, và giữ kết quả ổn định giữa các lần gọi.
