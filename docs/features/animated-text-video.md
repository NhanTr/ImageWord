# Tính năng: Video chữ màu in tuần tự

Trạng thái: `HOÀN THÀNH`

Ngày hoàn thành: 2026-08-13.

Nhánh: `feature-animated-text-video`  
Commit code: `7b54a42 feat: add animated colored text video`

## Hành vi

- Người dùng chọn một ảnh upload thuộc tài khoản và chọn kết quả `Video MP4`.
- Ký tự xuất hiện theo thứ tự row-major: từ trái sang phải trong từng hàng, sau đó từ trên xuống dưới.
- Thời gian in chữ điều chỉnh từ 2–10 giây; video giữ hình hoàn chỉnh thêm 1 giây.
- Frontend hiển thị video bằng `autoplay`, `loop`, `muted`, `playsInline` và `controls`, vì vậy hiệu ứng tự chạy và lặp trong gallery.
- Video có thể tải xuống bằng presigned URL như ảnh kết quả.

## API

```http
POST /api/v1/images/:id/generate-video
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "columns": 80,
  "characterSet": "@%#*+=-:. ",
  "fontFamily": "monospace",
  "backgroundColor": "#000000",
  "durationSeconds": 5
}
```

API trả `{ "image": PublicImage }`; record có `kind=GENERATED`, `mimeType=video/mp4`, `settings.output=video` và `settings.animation=row-major-reveal`.

## Kiến trúc

- Không thêm bảng PostgreSQL: video là một output GENERATED trong bảng `images` và tham chiếu ảnh nguồn qua `parent_image_id`.
- Backend tạo ảnh chữ hoàn chỉnh, dựng các frame RGB bằng cách mở từng cell theo row-major rồi encode H.264/MP4 bằng FFmpeg.
- File MP4 nằm trong MinIO private tại object key do server tạo; API không trả object key.
- Xóa ảnh nguồn tiếp tục cascade metadata và xóa cả PNG/MP4 liên quan khỏi MinIO.
- Giới hạn mặc định: 120 cột, 12.000 glyph, 20 FPS để giới hạn CPU/RAM của request đồng bộ.

## Xác minh

```text
frontend component tests                         3/3 PASS
backend unit + integration tests trong Docker   14/14 PASS
MP4 H.264 thật, header ftyp và MIME video/mp4    PASS
Docker Compose với FFmpeg                        healthy
lint, typecheck và production build              PASS
```

Runtime kiểm thử không có browser kết nối nên chưa chụp kiểm chứng trực quan tự động. Component test đã xác minh thuộc tính loop/autoplay của `<video>`; MP4 thật đã được sinh và kiểm tra trong integration test.
