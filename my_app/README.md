# My App - NestJS + Prisma + PostgreSQL + MQTT + Socket.IO

Dự án thực hành backend NestJS đã đi tới **tuần 6** với các phần chính:

- REST API với NestJS
- PostgreSQL qua Prisma
- Authentication JWT + phân quyền theo role
- Swagger
- MQTT để giao tiếp với ESP32
- Socket.IO để đẩy dữ liệu realtime tới client
- Microservice transport trong NestJS

## Trạng thái hiện tại theo tuần

### Tuần 1 – NestJS cơ bản & REST API
- `GET /hello` để kiểm tra server
- CRUD `users` cơ bản

### Tuần 2 – Database & CRUD với Prisma
- Kết nối PostgreSQL bằng Prisma
- CRUD `users` lưu xuống database
- Middleware log request
- Cấu hình biến môi trường bằng `.env`

### Tuần 3 – Authentication & quan hệ dữ liệu
- Model `User`, `Profile`, `Post`
- Hash mật khẩu bằng `bcryptjs`
- `POST /auth/register`, `POST /auth/login` trả về JWT
- Bảo vệ API bằng `JwtAuthGuard`

### Tuần 4 – Passport, Guard & Role-based Authentication
- Tích hợp `passport-jwt`
- `RolesGuard` và decorator `@Roles()`
- Phân quyền `admin` và `user`
- User chỉ đọc/tạo bài viết, admin có quyền quản lý đầy đủ hơn

### Tuần 5 – Swagger & cấu hình môi trường
- Swagger tại `http://localhost:3000/api`
- Hỗ trợ `Authorize` với Bearer token
- DTO có `@ApiProperty()`
- Đọc cấu hình từ `.env`

### Tuần 6 – Microservice, MQTT, Socket.IO
- Kết nối MQTT broker miễn phí HiveMQ
- Nhận dữ liệu từ ESP32 qua MQTT topic
- Publish command ngược về ESP32 qua MQTT
- Broadcast dữ liệu realtime qua Socket.IO
- Bật `Transport.MQTT` trong Nest microservice
- Tách phần MQTT vào `src/infrastructure/mqtt`

## Luồng MQTT hiện tại

ESP32 của bạn đang dùng các topic sau:

- Sensor data: `esp32/sensors/data`
- Command: `esp32/control/command`
- ACK: `esp32/control/ack`

Luồng xử lý:

- `ESP32 -> MQTT Broker -> NestJS -> Socket.IO -> FE/Postman`
- `API -> NestJS -> MQTT Broker -> ESP32`

## Cấu trúc thư mục chính

```text
src/
├─ infrastructure/
│  └─ mqtt/
│     ├─ controllers/
│     ├─ dto/
│     ├─ gateways/
│     ├─ services/
│     ├─ constants/
│     ├─ mqtt.module.ts
│     ├─ mqtt.types.ts
│     └─ index.ts
├─ module/auth/
├─ module/users/
├─ module/posts/
├─ prisma/
├─ common/middleware/logger.middleware.ts
├─ config/configuration.ts
├─ app.module.ts
└─ main.ts
```

## Cấu hình biến môi trường

Sao chép `.env.example` thành `.env` rồi chỉnh lại giá trị phù hợp:

```env
DATABASE_URL="postgresql://postgres:<db_password>@localhost:5432/myapp?schema=public"
JWT_SECRET="mot-chuoi-bi-mat-it-nhat-16-ky-tu"
JWT_EXPIRES_IN="1d"
PORT=3000
MQTT_BROKER_URL="mqtt://broker.hivemq.com:1883"
MQTT_SENSOR_TOPIC="esp32/sensors/data"
MQTT_COMMAND_TOPIC="esp32/control/command"
MQTT_ACK_TOPIC="esp32/control/ack"
```

## Chạy dự án

```bash
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run start:dev
```

Ứng dụng chạy tại:

- `http://localhost:3000`
- Swagger: `http://localhost:3000/api`

## API MQTT hiện có

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET | `/mqtt/status` | Xem trạng thái MQTT broker và topics |
| POST | `/mqtt/publish` | Publish payload lên MQTT broker |

### Ví dụ body `POST /mqtt/publish`

Gửi command xuống ESP32:

```json
{
  "topic": "esp32/control/command",
  "payload": {
    "command": "toggle",
    "value": 1,
    "source": "postman"
  },
  "retain": false,
  "qos": 0
}
```

Giả lập ESP32 gửi sensor data:

```json
{
  "topic": "esp32/sensors/data",
  "payload": {
    "id": 11,
    "packet_no": 126,
    "temperature": 30,
    "humidity": 60,
    "tds": 1100,
    "pH": 5.0
  },
  "retain": false,
  "qos": 0
}
```

## Cách test MQTT bằng Postman

Mình đã gộp sẵn phần hỗ trợ MQTT vào file collection:

- `postman_collection.json` – collection chính, chỉ còn HTTP
- `postman_week6_collection.json` – collection riêng cho tuần 6

### 1) Test HTTP MQTT

Import `postman_week6_collection.json`, rồi chạy:

- `GET /mqtt/status`
- `POST /mqtt/publish`

### 2) Test realtime Socket.IO trong Postman

Lưu ý quan trọng

- **Socket.IO không nên import từ JSON collection như request HTTP**.
- Nên **tạo thủ công trong Postman** để chắc chắn đúng loại request.

Các bước:

1. Mở Postman
2. Chọn **New**
3. Chọn **Socket.IO request** nếu Postman của bạn có hỗ trợ
4. Nhập URL:

```text
socketio://localhost:3000/mqtt
```

5. Kết nối vào namespace `/mqtt`
6. Sau khi connect, server sẽ đẩy các event:
   - `mqtt-status`
   - `mqtt-message`

7. Mở request HTTP `POST /mqtt/publish`
8. Gửi sensor data hoặc command
9. Quan sát dữ liệu realtime trong tab Socket.IO

### Nếu Postman không hỗ trợ Socket.IO request

Một số phiên bản Postman không tạo được Socket.IO request từ collection JSON. Nếu gặp tình huống này:

- tạo request Socket.IO thủ công trong UI
- hoặc test realtime bằng MQTTX + frontend / client riêng

## Cách test bằng MQTTX

Dùng các thông số sau:

- Broker: `mqtt://broker.hivemq.com:1883`
- Subscribe:
  - `esp32/sensors/data`
  - `esp32/control/command`
  - `esp32/control/ack`

Payload mẫu ESP32:

```json
{
  "id": 11,
  "packet_no": 126,
  "temperature": 30,
  "humidity": 60,
  "tds": 1100,
  "pH": 5.0
}
```

## Ghi chú quan trọng cho tuần 6

- Topic trong NestJS đã được đồng bộ với `ESP32_SendData`
- `mqtt/status` trả về topic hiện tại để bạn đối chiếu nhanh
- Phần realtime socket là **Socket.IO namespace `/mqtt`**, không phải WebSocket thuần
