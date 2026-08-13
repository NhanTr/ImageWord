# ImageWord — Session handoff

Cập nhật lần cuối: 2026-08-12, múi giờ Asia/Ho_Chi_Minh.

## Cách tiếp tục

Khi người dùng nhắn `tiếp tục`:

1. Đọc `AGENTS.md` và toàn bộ file này.
2. Chạy `git status --short --branch` và `git log --oneline --decorate -3`.
3. Giữ nguyên mọi thay đổi mới của người dùng nếu working tree không sạch.
4. Kiểm tra stack bằng `docker compose ps -a`; chạy `docker compose up --build -d` nếu cần.
5. Bắt đầu Mốc 5 — bộ xử lý ảnh thành chữ màu. Không làm lại Mốc 1–4.

Tin nhắn `tiếp tục` của người dùng được xem là xác nhận bắt đầu Mốc 5.

## Trạng thái Git tại thời điểm bàn giao

- Nhánh hiện tại: `milestone-4-image-storage`.
- Commit hoàn thành Mốc 4: `b4cee37 feat: complete milestone 4 image storage`.
- Commit nền của `main` và `dev`: `429b960 init project`.
- Handoff được commit riêng ngay sau `b4cee37`; working tree được kỳ vọng sạch khi tạm dừng.
- Chưa push nhánh lên remote.

Không tự merge vào `dev`/`main` và không push nếu người dùng chưa yêu cầu.

## Các mốc đã hoàn thành

- Mốc 1: yêu cầu, kiến trúc và schema được duyệt.
- Mốc 2: npm monorepo, Express/Vite, Dockerfile dev/prod và Docker Compose.
- Mốc 3: PostgreSQL migration, register/login/refresh/logout/me, JWT và Redis session.
- Mốc 4: upload JPEG/PNG/WebP, MinIO private, metadata, list/detail, presigned URL, ownership và cascade delete.

Tài liệu chi tiết:

- `docs/implementation-plan.md`
- `docs/milestones/02-foundation-and-docker.md`
- `docs/milestones/03-database-and-authentication.md`
- `docs/milestones/04-image-upload-and-storage.md`
- `docs/features/colored-text-generation.md`

## Trạng thái hệ thống gần nhất

Stack development đang chạy và healthy tại thời điểm tạm dừng:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

Không giả định trạng thái này còn đúng ở phiên sau; luôn kiểm tra bằng `docker compose ps -a`.

## Kiểm thử đã đạt

```text
npm run lint                    PASS
npm run typecheck               PASS
npm run build                   PASS
npm run format:check            PASS
auth + image integration tests  4/4 PASS
production backend build        PASS
production Sharp runtime        PASS
```

Lệnh integration test:

```bash
docker compose exec -T backend npm test --workspace @imageword/backend
```

## Mốc tiếp theo — Mốc 5

Mục tiêu: chuyển một ảnh UPLOADED thuộc user hiện tại thành PNG được cấu thành từ các ký tự có màu lấy từ vùng pixel tương ứng.

API dự kiến:

```text
POST /api/v1/images/:id/generate
```

Payload đã thiết kế:

```json
{
  "columns": 120,
  "characterSet": "@%#*+=-:. ",
  "fontFamily": "monospace",
  "backgroundColor": "#000000"
}
```

Phạm vi cần triển khai:

1. Validate image id, ownership, `kind=UPLOADED`, `status=READY` và generation settings.
2. Đọc ảnh nguồn private từ MinIO; normalize EXIF orientation.
3. Giới hạn `columns` 20–300 và tổng glyph/khối lượng xử lý.
4. Tính số hàng theo tỷ lệ ảnh và aspect ratio của glyph monospace.
5. Resize/lấy mẫu ảnh; tính luminance để ánh xạ character ramp.
6. Lấy RGB trung bình của cell để tô từng ký tự.
7. Escape mọi text/settings khi render SVG; font MVP chỉ dùng allowlist an toàn.
8. Chuyển SVG thành PNG bằng Sharp.
9. Lưu object ở `users/{userId}/generated/{imageId}/colored-text.png`.
10. Tạo record `GENERATED` liên kết `parent_image_id` và lưu settings.
11. Rollback object/metadata phù hợp khi MinIO hoặc PostgreSQL lỗi.
12. Viết unit test thuật toán và integration test ownership, object lifecycle, metadata liên kết và delete cascade.
13. Cập nhật `docs/features/colored-text-generation.md`, tạo báo cáo Mốc 5 và xin duyệt Mốc 6.

## Quyết định cần giữ

- PostgreSQL chỉ có hai bảng nghiệp vụ `users` và `images`; không thêm bảng job ở Mốc 5.
- Xử lý MVP đồng bộ trong request, với giới hạn tài nguyên rõ ràng.
- Kết quả là PNG, không trả SVG thô.
- MinIO bucket luôn private; API trả metadata hoặc presigned URL.
- Object key không dùng input do client cung cấp.
- API không được trả `bucket` hoặc `object_key`.
- Mọi truy vấn ảnh phải lọc cả `id` và `user_id`; tài nguyên user khác trả 404.
- Access JWT chỉ hợp lệ khi session Redis còn tồn tại.

## Các file backend quan trọng

- `backend/src/images/image.routes.ts`
- `backend/src/images/image.service.ts`
- `backend/src/images/image.repository.ts`
- `backend/src/images/image.storage.ts`
- `backend/src/images/image.types.ts`
- `backend/src/images/image.integration.test.ts`
- `backend/src/auth/auth.middleware.ts`
- `backend/src/config.ts`
- `backend/migrations/001_initial_schema.sql`

## Lưu ý kỹ thuật

- Backend dùng `MINIO_ENDPOINT=http://minio:9000` để truyền dữ liệu trong Docker.
- Presigned URL dùng `MINIO_PUBLIC_ENDPOINT=http://localhost:9000` cho trình duyệt.
- Upload mặc định tối đa 10 MB và 40 triệu pixel.
- Sharp đã được cài và xác minh trong production image Alpine.
- Delete cây ảnh hiện xóa object MinIO trước, sau đó cascade metadata trong transaction PostgreSQL. Nếu mở rộng cơ chế retry/reconciliation, phải ghi rõ trong docs.
- Không dừng/xóa Docker volumes khi tiếp tục; dữ liệu PostgreSQL/Redis/MinIO nằm trong named volumes.
