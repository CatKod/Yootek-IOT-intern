# My App - NestJS + Prisma + PostgreSQL

Dự án thực hành 5 tuần: Backend NestJS với REST API, PostgreSQL qua Prisma, xác thực JWT, phân quyền theo vai trò, tài liệu Swagger và cấu hình bằng `.env`.

## Nội dung đã hoàn thành

- **Tuần 1 – NestJS cơ bản & REST API**
  - `GET /hello` trả về `{ "message": "Hello NestJS!" }`
  - CRUD `users` (Controller + Service)
- **Tuần 2 – Database & hoàn thiện CRUD**
  - Kết nối PostgreSQL bằng **Prisma**
  - CRUD `users` lưu vào database
  - **Middleware log request** (`src/common/middleware/logger.middleware.ts`)
  - Cấu hình biến môi trường bằng `.env` và `ConfigModule`
- **Tuần 3 – Prisma, quan hệ & Authentication**
  - Model `User`, `Profile` (quan hệ **1-1**), `Post` (quan hệ **1-n**)
  - Hash mật khẩu bằng `bcryptjs`
  - `POST /auth/register`, `POST /auth/login` trả về **JWT**
  - **Guard kiểm tra token** (`JwtAuthGuard`) bảo vệ các API `users`, `posts`
- **Tuần 4 – Passport, Guard & Role-based Authentication**
  - Tích hợp **Passport** với `passport-jwt` và `JwtStrategy`
  - Sử dụng `JwtAuthGuard` để xác thực Bearer token
  - Xây dựng `RolesGuard` và decorator `@Roles()`
  - Phân quyền `admin` và `user`
  - User chỉ có thể tạo và đọc bài viết
  - Admin có thể cập nhật và xóa bài viết
- **Tuần 5 – Swagger và cấu hình môi trường**
  - Tài liệu API Swagger tại `http://localhost:3000/api`
  - Swagger UI hỗ trợ Bearer JWT bằng nút `Authorize`
  - Bổ sung mô tả và ví dụ request cho các DTO bằng `@ApiProperty()`
  - Đọc `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` và `PORT` từ `.env`
  - Kiểm tra biến môi trường bắt buộc khi ứng dụng khởi động
  - Prisma CLI và NestJS dùng chung cấu hình từ `.env`

## Cấu trúc thư mục chính

```
src/
├─ module/auth/     # Đăng ký, đăng nhập, JWT, guard
├─ module/users/    # CRUD user + profile (1-1)
├─ module/posts/    # CRUD post (1-n với user)
├─ prisma/          # PrismaService (kết nối DB)
├─ common/middleware/logger.middleware.ts
├─ config/configuration.ts   # kiểm tra và nạp cấu hình từ .env
├─ app.module.ts
└─ main.ts                  # bootstrap app và cấu hình Swagger
prisma/schema.prisma
prisma.config.ts             # nạp dotenv cho Prisma CLI
.env.example                 # mẫu biến môi trường
```

## Cấu hình biến môi trường

Sao chép `.env.example` thành `.env`, sau đó thay các giá trị phù hợp:

```env
DATABASE_URL="postgresql://postgres:<db_password>@localhost:5432/myapp?schema=public"
JWT_SECRET="mot-chuoi-bi-mat-it-nhat-16-ky-tu"
JWT_EXPIRES_IN="1d"
PORT=3000
```

<<<<<<< HEAD
<<<<<<< Updated upstream
> Thay `<db_password>` bằng mật khẩu user PostgreSQL thật (mặc định user là `postgres`, cổng `5432`). Ứng dụng và Prisma CLI đều đọc chung file này.
=======
`ConfigModule` dùng `.env` cho ứng dụng NestJS và Prisma CLI. Không commit file `.env` vì file này chứa thông tin nhạy cảm. `DATABASE_URL` là bắt buộc, `JWT_SECRET` phải có ít nhất 16 ký tự và `PORT` phải nằm trong khoảng 1-65535. Ứng dụng sẽ dừng khởi động nếu cấu hình không hợp lệ.

### Swagger

Sau khi chạy ứng dụng, mở:

```text
http://localhost:3000/api
```

Để kiểm thử các API cần đăng nhập:

1. Gọi `POST /auth/register` để tạo tài khoản.
2. Gọi `POST /auth/login` và sao chép `accessToken`.
3. Bấm **Authorize** trên Swagger.
4. Nhập `Bearer <accessToken>` rồi bấm **Authorize**.
5. Sử dụng **Try it out** để gọi các endpoint Users và Posts.

Swagger hiển thị các nhóm `Health`, `Authentication`, `Users` và `Posts`, cùng mô tả request body và ví dụ dữ liệu cho các DTO.
>>>>>>> Stashed changes
=======
`ConfigModule` dùng `.env` cho ứng dụng NestJS và Prisma CLI. Không commit file `.env` vì file này chứa thông tin nhạy cảm. Swagger khả dụng tại `http://localhost:3000/api` sau khi ứng dụng khởi động.
>>>>>>> c87a52eb7f5f64e53048eafb23eef107dd456818

## Các bước chạy

```bash
# 1. Cài dependencies
npm install

# 2. Sinh Prisma Client
npm run prisma:generate

# 3. Áp dụng các migration đã có
npx prisma migrate deploy

# 4. Chạy dev
npm run start:dev
```

Ứng dụng chạy tại `http://localhost:3000`.

> Yêu cầu: PostgreSQL đã cài, server PostgreSQL đang chạy và database trong `DATABASE_URL` đã tồn tại hoặc tài khoản PostgreSQL có quyền tạo database. Có thể dùng `npx prisma studio` để xem dữ liệu trong 3 bảng `User`, `Profile`, `Post`.

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

## Kiểm tra phân quyền

- Role `user` có thể tạo và đọc bài viết.
- Role `admin` có thể tạo, đọc, cập nhật và xóa bài viết.
- Các API Users được bảo vệ bằng JWT và `RolesGuard`; một số thao tác yêu cầu role `admin`.
- Không có token hợp lệ sẽ nhận `401 Unauthorized`.
- Có token nhưng không đủ quyền sẽ nhận `403 Forbidden`.

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
