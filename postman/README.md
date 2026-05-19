# Postman — AI Document Platform

## Import vào Postman

1. Mở Postman → **Import** → chọn:
   - `AI-Document-Platform.postman_collection.json`
   - `Local.postman_environment.json` (tùy chọn)
2. Chọn environment **AI Document Platform — Local** (góc trên phải).
3. Chạy server: `bun run dev` (mặc định `http://localhost:3000`).

## Auth — lưu token tự động

1. Gọi **Auth → Login** (email/password mặc định trùng `SEED_ADMIN_*` trong `.env`).
2. Tab **Tests** của request Login sẽ gán `accessToken` vào **Collection variables**.
3. Các request còn lại dùng **Bearer Token** `{{accessToken}}` (kế thừa từ collection).

Bạn cũng có thể dùng **Register** — script tương tự sẽ lưu token sau 201.

## Thứ tự gợi ý

| Bước | Request |
|------|---------|
| 1 | Health → Health Check |
| 2 | Auth → Login |
| 3 | Auth → Get Me |
| 4 | Documents → Upload Document (chọn file trong Body → form-data) |
| 5 | Jobs → Get Job Status (poll đến khi xong) |
| 6 | Search → Search / RAG Retrieval |
| 7 | Activity Logs → List Activity Logs |

Upload và List Documents tự gán `documentId` / `jobId` khi response thành công.

## Biến

| Biến | Mô tả |
|------|--------|
| `baseUrl` | URL server (mặc định `http://localhost:3000`) |
| `accessToken` | JWT — set sau Login/Register |
| `adminEmail` / `adminPassword` | Credentials login |
| `documentId` / `jobId` | Set sau upload hoặc list |

Swagger UI: `{{baseUrl}}/swagger`
