# SmartGarden — Hệ thống IoT quản lý khu vườn

Đề tài: hệ thống IoT giúp người dùng quản lý khu vườn (rau, doanh thu), giám sát môi trường
trực quan qua WebSocket và điều khiển đèn từ xa qua MQTT. Bao gồm hai phần:

- `SmartGarden/SmartGarden_ESP` — firmware ESP32 (ESP-IDF) gửi dữ liệu cảm biến và nhận lệnh bật/tắt đèn.
- `SmartGarden/smart-garden-app` — backend NestJS + PostgreSQL + Prisma + MQTT + WebSocket + Swagger.

## Kiến trúc

```
ESP32  --(MQTT publish sensor)-->  MQTT Broker (HiveMQ)  --(MQTT subscribe)-->  NestJS Server
                                                                         |
                                                                         +--> Lưu PostgreSQL (Prisma)
                                                                         +--> Phát WebSocket (Socket.IO) --> FE/Postman
FE/Postman --(REST API)--> NestJS Server --(MQTT publish command)--> MQTT Broker --> ESP32 (bật/tắt LED)
```

## Tính năng chính

- **Auth & phân quyền**: đăng ký/đăng nhập JWT, Passport + Guard, Role-based (admin/user).
- **Quản lý khu vườn**: CRUD Garden, mỗi user có nhiều garden, admin thấy tất cả.
- **Quản lý rau**: CRUD Vegetable, nhập/xuất, đảm bảo `soldQuantity <= importedQuantity`.
- **Giá & doanh thu**:
  - `POST/PUT/DELETE/GET /vegetables/:id/price` — CRUD giá rau.
  - `POST /vegetables/:id/sell` — bán rau, tự sinh bản ghi `Sale` và tính `totalAmount`.
  - `GET /price?range=day|week|month` — danh sách giá theo khoảng thời gian.
  - `GET /all/price?range=day|week|month` — tổng doanh thu (phân theo garden) theo khoảng thời gian.
  - `GET /gardens/:id/revenue?range=...` — doanh thu của một khu vườn.
  - `GET /gardens/revenue/all?range=...` — tổng doanh thu toàn hệ thống (admin).
- **Giám sát môi trường**: nhận nhiệt độ/độ ẩm từ ESP32 qua MQTT, lưu `SensorData`, phát WebSocket realtime.
  - `GET /sensor-data/:gardenId` (lọc `from`/`to`/`limit`), `GET /sensor-data/:gardenId/latest`, `GET /sensor-data/:gardenId/avg-24h`.
- **Điều khiển đèn**: `POST /gardens/:id/led` (body `{led1State, led2State, led3State}` = `On|Off`) ->
  server publish command MQTT -> ESP32 bật/tắt LED vật lý -> ESP32 gửi ACK.
- **MQTT raw**: `POST /mqtt/command` (publish command tay), `GET /mqtt/status`.
- **Tài liệu**: Swagger UI tại `http://localhost:3000/api`.

## Mô hình dữ liệu (Prisma)

- `User(id, name, email, password, role)` — 1 User có nhiều Garden.
- `Garden(id, name, description, ownerId, led1State, led2State, led3State)` — 1 Garden có nhiều Vegetable, Sale, SensorData.
- `Vegetable(id, name, importedQuantity, soldQuantity, currentPrice, gardenId)` — 1 Vegetable có nhiều VegetablePrice, Sale.
- `VegetablePrice(id, vegetableId, price, effectiveAt)` — lịch sử giá.
- `Sale(id, gardenId, vegetableId, quantity, unitPrice, totalAmount, soldAt)` — giao dịch bán.
- `SensorData(id, gardenId, deviceId, packetNo, temperature, humidity, payload, receivedAt)`.

Xem chi tiết tại `SmartGarden/smart-garden-app/prisma/schema.prisma`.

## Cách chạy Backend (NestJS)

Yêu cầu: Node.js >= 18, PostgreSQL đang chạy (hoặc dùng Prisma Postgres dev server).

```bash
cd SmartGarden/smart-garden-app
cp .env.example .env        # rồi sửa DATABASE_URL, JWT_SECRET, ...
npm install
npx prisma generate         # sinh Prisma Client vào src/generated/prisma
npx prisma migrate dev      # tạo schema trong PostgreSQL (hoặc `npx prisma db push`)
npm run start:dev           # chạy ở http://localhost:3000
```

Swagger: <http://localhost:3000/api>

### Biến môi trường (`.env`)

Xem `.env.example`. Các biến quan trọng:

- `DATABASE_URL` — connection string PostgreSQL.
- `JWT_SECRET`, `JWT_EXPIRES_IN`.
- `MQTT_BROKER_URL` — ví dụ `mqtt://broker.hivemq.com:1883`.

## Cách chạy Firmware ESP32 (ESP-IDF)

Yêu cầu: ESP-IDF v5.x/v6.x (project đang cấu hình cho ESP32-S3).

```bash
cd SmartGarden/SmartGarden_ESP
idf.py menuconfig        # SmartGarden Configuration: WiFi, MQTT broker, GARDEN_ID, LED GPIOs...
idf.py build
idf.py -p COMx flash monitor
```

Qua `menuconfig → SmartGarden Configuration` cần đặt:

- `WIFI_SSID`, `WIFI_PASSWORD`.
- `MQTT_BROKER_URI` (mặc định `mqtt://broker.hivemq.com:1883`).
- `GARDEN_ID`, `USER_ID` (phải khớp với garden/user đã tạo trong backend).
- `MQTT_SENSOR_TOPIC` = `smart-garden/sensors` (khớp backend).
- `MQTT_COMMAND_TOPIC` = `smart-garden/commands`.
- `MQTT_ACK_TOPIC` = `smart-garden/ack`.
- `MQTT_STATUS_TOPIC` = `smart-garden/status`.
- `LED_RED_GPIO`, `LED_YELLOW_GPIO`, `LED_GREEN_GPIO` (mặc định 2/4/5).

> Dữ liệu cảm biến hiện được mô phỏng trong `sensor_task` (nhiệt/ẩm giả lập). Để dùng cảm biến thật
> (DHT22/BME280...), thay thế phần sinh giá trị trong `sensor_task()` bằng thư viện driver tương ứng.

## Test luồng với MQTTX / Postman

1. Khởi động backend + flash ESP32 (cùng broker HiveMQ công khai).
2. Đăng ký/đăng nhập qua `POST /auth/register`, `POST /auth/login` để lấy JWT.
3. Tạo garden `POST /gardens` (lưu `gardenId`, đặt `GARDEN_ID` trên ESP32 = id này).
4. Xem dữ liệu cảm biến đẩy lên: WebSocket tới `ws://localhost:3000/smart-garden` (event `sensor-data`),
   hoặc `GET /sensor-data/:gardenId/latest`.
5. Bật đèn: `POST /gardens/:gardenId/led` với `{ "led1State": "On", "led2State": "Off", "led3State": "Off" }`.
   ESP32 sẽ đổi GPIO LED và gửi ACK (event `led-state` qua WebSocket).

## Định hướng mở rộng

- Caching Redis cho dữ liệu cảm biến/doanh thu gần nhất.
- Notification qua WebSocket khi nhiệt/độ ẩm vượt ngưỡng.
- Biểu đồ doanh thu realtime trên frontend.
- Logging, Error Handling middleware, Unit Testing.
