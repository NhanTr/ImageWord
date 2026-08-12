# Mốc 6 — Frontend Vite

Trạng thái: `HOÀN THÀNH, CHỜ NGHIỆM THU`

Ngày hoàn thành: 2026-08-12.

## Kết quả

- Hoàn thiện màn hình đăng ký/đăng nhập và khôi phục phiên bằng refresh cookie.
- Xây API client giữ JWT trong memory, chống nhiều refresh đồng thời và retry request sau 401.
- Xây upload picker/drag-drop, validation, local preview và chọn ảnh nguồn.
- Xây form generation cho columns, character set, background color.
- Xây gallery cursor pagination, filter loại ảnh, preview, download, quan hệ source/result và delete confirmation.
- Bổ sung responsive design, accessibility cơ bản, loading/empty/error/success state.
- Bổ sung Vitest, Testing Library và hai test frontend.

## Xác minh

```text
npm run lint                                      PASS
npm run typecheck                                 PASS
npm run build --workspace @imageword/frontend     PASS
npm run test --workspace @imageword/frontend      2/2 PASS
backend integration tests trong Docker            11/11 PASS
Docker Compose                                    healthy
API E2E register→upload→generate→delete→logout     PASS
```

Kiểm thử trực quan bằng browser chưa thực hiện được vì runtime không phát hiện browser kết nối. Mốc 7 phải chạy lại responsive/interaction E2E khi browser khả dụng.
