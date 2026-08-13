# ImageWord - Quy tắc phát triển

## Mục tiêu

Xây dựng ứng dụng web cho phép người dùng đăng ký, đăng nhập, tải ảnh lên và chuyển ảnh thành ảnh chữ màu. Màu của mỗi ký tự được lấy từ vùng pixel tương ứng trong ảnh nguồn.

## Công nghệ đã chốt

- Backend: Node.js, TypeScript, Express.
- Frontend: React, TypeScript, Vite.
- Database: PostgreSQL.
- Object storage: MinIO.
- Cache/session: Redis.
- Môi trường local: Docker Compose.

## Quy tắc kiến trúc

- PostgreSQL chỉ lưu người dùng và metadata của ảnh đầu vào/đầu ra.
- Không lưu binary ảnh hoặc JWT thô trong PostgreSQL.
- MinIO lưu toàn bộ file ảnh nguồn và file kết quả.
- Redis lưu phiên đăng nhập theo `jti`; chỉ lưu hash của refresh token, không lưu mật khẩu hoặc refresh token dạng rõ.
- Ảnh của mỗi người dùng phải được phân quyền ở cả API và object key.
- File MinIO để private; backend cấp presigned URL có thời hạn khi người dùng hợp lệ yêu cầu.
- Mỗi ảnh sinh ra phải tham chiếu ảnh nguồn bằng `parent_image_id`.
- API phải validate input, giới hạn dung lượng/MIME và không tin tên file do client gửi lên.

## Quy trình xác nhận

- Thực hiện lần lượt các mốc trong `docs/implementation-plan.md`.
- Không bắt đầu mốc mới khi người dùng chưa xác nhận mốc hiện tại.
- Khi hoàn thành một tính năng, cập nhật file tương ứng trong `docs/features/` với trạng thái, API thực tế, quyết định và cách kiểm thử.
- Nếu implementation khác tài liệu, cập nhật tài liệu trong cùng thay đổi.

## Tiếp tục sau khi tạm dừng

- Khi người dùng nhắn `tiếp tục`, phải đọc toàn bộ `docs/SESSION_HANDOFF.md` trước khi thực hiện thay đổi.
- Đối chiếu nhánh/commit và working tree thực tế với handoff; không reset hoặc ghi đè thay đổi mới của người dùng.
- Không làm lại các mốc đã hoàn thành.
- Tin nhắn `tiếp tục` được xem là xác nhận bắt đầu mốc kế tiếp được ghi trong handoff.
- Sau khi hoàn thành mốc kế tiếp, cập nhật lại handoff hoặc thay thế bằng trạng thái mới.

## Chuẩn triển khai

- Dùng TypeScript strict mode cho frontend và backend.
- API trả lỗi theo một cấu trúc thống nhất.
- Migration là nguồn sự thật của schema database.
- Không commit secret; cung cấp `.env.example`.
- Mỗi mốc phải có kiểm thử phù hợp và lệnh kiểm tra được ghi lại.
