# Mốc 4 — Upload và lưu trữ ảnh

Trạng thái: `HOÀN THÀNH`, chờ người dùng nghiệm thu.

## Thay đổi chính

- Upload multipart trong memory với giới hạn 10 MB.
- Kiểm tra magic bytes và MIME cho JPEG, PNG, WebP bằng `file-type`.
- Đọc/validate kích thước ảnh và giới hạn pixel bằng Sharp.
- Object key không phụ thuộc tên file client và nằm dưới namespace user.
- Lưu object private ở MinIO, metadata ở PostgreSQL.
- List/filter bằng keyset cursor ổn định.
- Detail và presigned URL chỉ dành cho owner.
- Xóa ảnh trong transaction PostgreSQL, xóa mọi object trong cây ảnh trước khi cascade metadata.
- Rollback object khi upload MinIO thành công nhưng insert PostgreSQL lỗi.

## API

```text
POST   /api/v1/images
GET    /api/v1/images
GET    /api/v1/images/:id
GET    /api/v1/images/:id/url
DELETE /api/v1/images/:id
```

## Xác minh đã chạy

```text
npm run lint                    PASS
npm run typecheck               PASS
npm run build                   PASS
npm run format:check            PASS
auth + image integration tests  4/4 PASS
private MinIO bucket            PASS (anonymous HTTP 403)
cross-user ownership            PASS
upload/delete object lifecycle  PASS
generated child cascade         PASS
production Sharp runtime        PASS (PNG 2x2 decoded)
```

## Quyết định vận hành

`MINIO_ENDPOINT` là endpoint nội bộ backend dùng để truyền dữ liệu. `MINIO_PUBLIC_ENDPOINT` là endpoint trình duyệt có thể truy cập và được dùng khi ký presigned URL. Hai giá trị thường khác nhau khi chạy Docker hoặc sau reverse proxy.
