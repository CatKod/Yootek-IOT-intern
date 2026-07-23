# My App - NestJS + Prisma + MongoDB

Dự án thực hành 3 tuần: Backend NestJS với REST API, kết nối MongoDB qua Prisma và xác thực bằng JWT.

## Nội dung đã hoàn thành

- **Tuần 1 – NestJS cơ bản & REST API**
  - `GET /hello` trả về `{ "message": "Hello NestJS!" }`
  - CRUD `users` (Controller + Service)
- **Tuần 2 – Database & hoàn thiện CRUD**
  - Kết nối MongoDB bằng **Prisma**
  - CRUD `users` lưu vào database
  - **Middleware log request** (`src/common/middleware/logger.middleware.ts`)
  - Cấu hình đọc từ `secrets/secret.json` qua `ConfigModule`
- **Tuần 3 – Prisma, quan hệ & Authentication**
  - Model `User`, `Profile` (quan hệ **1-1**), `Post` (quan hệ **1-n**)
  - Hash mật khẩu bằng `bcryptjs`
  - `POST /auth/register`, `POST /auth/login` trả về **JWT**
  - **Guard kiểm tra token** (`JwtAuthGuard`) bảo vệ các API `users`, `posts`

## Cấu trúc thư mục chính

```
src/
├─ auth/            # Đăng ký, đăng nhập, JWT, guard
├─ users/           # CRUD user + profile (1-1)
├─ posts/           # CRUD post (1-n với user)
├─ prisma/          # PrismaService (kết nối DB)
├─ common/middleware/logger.middleware.ts
├─ config/configuration.ts   # đọc secrets/secret.json
├─ app.module.ts
└─ main.ts
prisma/schema.prisma
prisma.config.ts    # nạp connection string từ secrets/secret.json cho Prisma CLI
```

## Cấu hình (secrets/secret.json)

```json
{
  "MONGODB_URI": "mongodb+srv://user:<db_password>@cluster.mongodb.net/myapp?retryWrites=true&w=majority",
  "JWT_SECRET": "chuoi-bi-mat-that-dai",
  "JWT_EXPIRES_IN": "1d"
}
```

> Thay `<db_password>` bằng mật khẩu MongoDB Atlas thật. Ứng dụng và Prisma CLI đều đọc chung file này.

## Các bước chạy

```bash
# 1. Cài dependencies
npm install

# 2. Sinh Prisma Client
npm run prisma:generate

# 3. Đẩy schema lên MongoDB (tạo collection/index)
npm run prisma:push

# 4. Chạy dev
npm run start:dev
```

Ứng dụng chạy tại `http://localhost:3000`.

## Danh sách API

| Method | Endpoint               | Cần token | Mô tả                                 |
| ------ | ---------------------- | ---------- | --------------------------------------- |
| GET    | `/hello`             | Không     | Kiểm tra server                        |
| POST   | `/auth/register`     | Không     | Đăng ký, trả về JWT                |
| POST   | `/auth/login`        | Không     | Đăng nhập, trả về JWT              |
| GET    | `/auth/me`           | Có        | Thông tin user từ token               |
| POST   | `/users`             | Có        | Tạo user                               |
| GET    | `/users`             | Có        | Danh sách user                         |
| GET    | `/users/:id`         | Có        | Chi tiết user (kèm profile, posts)    |
| PATCH  | `/users/:id`         | Có        | Cập nhật user                         |
| DELETE | `/users/:id`         | Có        | Xóa user                               |
| PUT    | `/users/:id/profile` | Có        | Tạo/cập nhật profile (1-1)           |
| POST   | `/posts`             | Có        | Tạo post (gắn với user đăng nhập) |
| GET    | `/posts`             | Có        | Danh sách post (kèm tác giả)        |
| GET    | `/posts/:id`         | Có        | Chi tiết post                          |
| PATCH  | `/posts/:id`         | Có        | Cập nhật post                         |
| DELETE | `/posts/:id`         | Có        | Xóa post                               |

Với các API cần token, thêm header: `Authorization: Bearer <accessToken>`.

## Ví dụ test nhanh (Postman/curl)

```bash
# Đăng ký
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Nguyen Van A","email":"a@example.com","password":"123456"}'

# Đăng nhập -> lấy accessToken
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@example.com","password":"123456"}'

# Tạo post (thay <TOKEN>)
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"title":"Bai viet dau tien","content":"Xin chao"}'
```
