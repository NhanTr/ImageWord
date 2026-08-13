# ImageWord — Session handoff

Cập nhật lần cuối: 2026-08-12 sau khi hoàn thành Mốc 6, múi giờ Asia/Ho_Chi_Minh.

## Cách tiếp tục

Khi người dùng nhắn `tiếp tục`:

1. Đọc `AGENTS.md` và toàn bộ file này.
2. Chạy `git status --short --branch` và `git log --oneline --decorate -3`.
3. Giữ nguyên mọi thay đổi mới của người dùng nếu working tree không sạch.
4. Kiểm tra stack bằng `docker compose ps -a`; chạy `docker compose up --build -d` nếu cần.
5. Nếu người dùng đã nghiệm thu Mốc 6, bắt đầu Mốc 7 — hoàn thiện và kiểm thử end-to-end. Không làm lại Mốc 1–6.

Tin nhắn `tiếp tục` tiếp theo chỉ được xem là xác nhận Mốc 7 sau khi Mốc 6 đã được bàn giao cho người dùng.

## Trạng thái Git tại thời điểm bàn giao

- Nhánh hiện tại: `milestone-6-frontend-workspace`.
- Commit hoàn thành Mốc 4: `b4cee37 feat: complete milestone 4 image storage`.
- Commit hoàn thành Mốc 5: `abcb98f feat: complete milestone 5 colored text generation`.
- Commit nền của `main` và `dev`: `429b960 init project`.
- Handoff Mốc 4 được commit riêng ngay sau `b4cee37`.
- Mốc 6 được commit trên nhánh hiện tại sau commit Mốc 5; working tree được kỳ vọng sạch.
- Chưa push nhánh lên remote.

Không tự merge vào `dev`/`main` và không push nếu người dùng chưa yêu cầu.

## Các mốc đã hoàn thành

- Mốc 1: yêu cầu, kiến trúc và schema được duyệt.
- Mốc 2: npm monorepo, Express/Vite, Dockerfile dev/prod và Docker Compose.
- Mốc 3: PostgreSQL migration, register/login/refresh/logout/me, JWT và Redis session.
- Mốc 4: upload JPEG/PNG/WebP, MinIO private, metadata, list/detail, presigned URL, ownership và cascade delete.
- Mốc 5: chuyển ảnh thành PNG chữ màu, vector glyph ổn định, generation lifecycle và rollback.
- Mốc 6: frontend authentication, upload/generation workspace, private gallery và frontend tests.

Tài liệu chi tiết:

- `docs/implementation-plan.md`
- `docs/milestones/02-foundation-and-docker.md`
- `docs/milestones/03-database-and-authentication.md`
- `docs/milestones/04-image-upload-and-storage.md`
- `docs/milestones/05-colored-text-generation.md`
- `docs/milestones/06-frontend-workspace.md`
- `docs/features/colored-text-generation.md`
- `docs/features/frontend-workspace.md`

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
all backend tests               11/11 PASS
all frontend tests              2/2 PASS
production backend build        PASS
production Sharp runtime        PASS
production generator runtime    PASS, deterministic PNG
API E2E full user flow           PASS
```

Lệnh integration test:

```bash
docker compose exec -T backend npm test --workspace @imageword/backend
```

## Mốc tiếp theo — Mốc 7

Mục tiêu: hardening, kiểm thử end-to-end và hoàn thiện hướng dẫn vận hành.

Phạm vi dự kiến:

1. Chạy browser E2E thực tế cho đăng ký/đăng nhập, refresh, upload, generation, download và delete.
2. Kiểm tra responsive/interaction UI khi browser runtime khả dụng; đây là phần chưa chạy được ở Mốc 6 vì không có browser kết nối.
3. Test phân quyền chéo user, upload lỗi và trạng thái failure qua full HTTP stack.
4. Kiểm tra restart container không mất dữ liệu PostgreSQL/MinIO.
5. Rà soát security headers, CORS, rate limit, secret handling và production compose.
6. Hoàn thiện README local/production và checklist triển khai.

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
- `backend/src/images/colored-text.generator.ts`
- `backend/src/images/generation.service.ts`
- `backend/src/images/generation.integration.test.ts`
- `backend/src/auth/auth.middleware.ts`
- `backend/src/config.ts`
- `backend/migrations/001_initial_schema.sql`

## Các file frontend quan trọng

- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/types.ts`
- `frontend/src/components/AuthScreen.tsx`
- `frontend/src/components/Workspace.tsx`
- `frontend/src/components/ImageCard.tsx`
- `frontend/src/components/ImagePreview.tsx`
- `frontend/src/styles.css`
- `frontend/src/api.test.ts`
- `frontend/src/App.test.tsx`

## Lưu ý kỹ thuật

- Backend dùng `MINIO_ENDPOINT=http://minio:9000` để truyền dữ liệu trong Docker.
- Presigned URL dùng `MINIO_PUBLIC_ENDPOINT=http://localhost:9000` cho trình duyệt.
- Upload mặc định tối đa 10 MB và 40 triệu pixel.
- Sharp đã được cài và xác minh trong production image Alpine.
- Roboto Mono được đóng gói và chuyển thành vector path bằng OpenType; không phụ thuộc Fontconfig.
- Delete cây ảnh hiện xóa object MinIO trước, sau đó cascade metadata trong transaction PostgreSQL. Nếu mở rộng cơ chế retry/reconciliation, phải ghi rõ trong docs.
- Không dừng/xóa Docker volumes khi tiếp tục; dữ liệu PostgreSQL/Redis/MinIO nằm trong named volumes.
