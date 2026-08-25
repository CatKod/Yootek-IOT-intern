# BÁO CÁO THỰC TẬP — HỆ THỐNG SMARTGARDEN IoT

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Công nghệ sử dụng](#3-công-nghệ-sử-dụng)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Database Schema](#5-database-schema)
6. [Chi tiết các module Backend](#6-chi-tiết-các-module-backend)
7. [API Endpoints](#7-api-endpoints)
8. [Bảo mật & Phân quyền](#8-bảo-mật--phân-quyền)
9. [ESP32 Firmware (IoT)](#9-esp32-firmware-iot)
10. [MQTT & WebSocket](#10-mqtt--websocket)
11. [Kiểm thử](#11-kiểm-thử)
12. [Hướng dẫn cài đặt và chạy](#12-hướng-dẫn-cài-đặt-và-chạy)
13. [Kết luận và hướng phát triển](#13-kết-luận-và-hướng-phát-triển)

---

## 1. Tổng quan dự án

**SmartGarden** là một hệ thống IoT quản lý vườn thông minh. Hệ thống cho phép:

- **Quản lý khu vườn**: Người dùng tạo, sửa, xóa vườn; thêm rau, nhập giá, bán rau, tính doanh thu.
- **Giám sát môi trường**: ESP32 gửi dữ liệu nhiệt độ, độ ẩm qua MQTT → server lưu trữ → WebSocket đẩy real-time.
- **Điều khiển thiết bị**: Bật/tắt đèn (đỏ, vàng, xanh) qua API → MQTT → ESP32 → ACK ngược lại.
- **Bảo mật**: JWT Authentication + Role-based Authorization (Admin / User).
- **Tài liệu API**: Swagger UI tại `/api`.

Dự án được xây dựng trong 11 tuần thực tập, từ làm quen NestJS → Database → Authentication → MQTT/WebSocket → hoàn thiện đề tài.

---

## 2. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (postgres)                          │
│                   WebSocket Client (Socket.IO)                      │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                            ┌──────┴──────┐
                            │  HTTP API   │
                            │  WebSocket  │
                            │  (Port 3000)│
                            └──────┬──────┘
                                   │
┌──────────────────────────────────┴──────────────────────────────────┐
│                   NESTJS BACKEND (smart-garden-app)                 │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐    │
│  │   Auth   │  │  Garden  │  │ Vegetable│  │  Sensor           │    │
│  │  Module  │  │  Module  │  │  Module  │  │  Module           │    │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────────┘    │
│  ┌──────────┐  ┌───────────────────┐  ┌───────────────────┐         │
│  │  Price   │  │  MQTT (Broker)    │  │  WebSocket        │         │
│  │  Module  │  │  (mqtt.js)        │  │  (Socket.IO)      │         │
│  └──────────┘  └────────┬──────────┘  └────────┬──────────┘         │
│                         │                      │                    │
│                         │  MQTT Events         │  Emit events       │
│                         └──────────────────────┘                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Prisma ORM + PostgreSQL                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ┌────────┴────────┐      ┌─────────┴────────┐
     │  MQTT Broker    │      │  PostgreSQL      │
     │  (HiveMQ)       │      │  (Localhost:5432)│
     └────────┬────────┘      └──────────────────┘
              │
     ┌────────┴────────┐
     │  ESP32 Client   │
     │  (WiFi + MQTT)  │
     │  - Sensors      │
     │  - 3 LEDs       │
     └─────────────────┘
```

**Luồng dữ liệu chính:**

1. **Sensor → Server**: ESP32 publish MQTT → HiveMQ → Server subscribe → lưu DB → WebSocket push đến client.
2. **API → ESP32**: User gọi API bật đèn → Server publish MQTT command → HiveMQ → ESP32 nhận, bật đèn, publish ACK → Server nhận ACK → WebSocket thông báo.
3. **API → DB**: CRUD gardens, vegetables, prices, sales, sensor data.

---

## 3. Công nghệ sử dụng

| Thành phần | Công nghệ | Phiên bản |
|---|---|---|
| **Backend Framework** | NestJS | ^11.0.1 |
| **Ngôn ngữ** | TypeScript | ^5.7.3 |
| **Database** | PostgreSQL 17 | Local |
| **ORM** | Prisma | ^7.9.1 |
| **Authentication** | JWT + Passport + bcryptjs | |
| **MQTT Client** | mqtt.js (NestJS), esp-mqtt (ESP32) | |
| **WebSocket** | Socket.IO (@nestjs/websockets) | |
| **API Documentation** | Swagger / OpenAPI | |
| **Validation** | class-validator + class-transformer | |
| **IoT Device** | ESP32-S3 (ESP-IDF) | |
| **IoT Firmware** | C (ESP-IDF) + cJSON | |
| **Testing** | Jest + Supertest | |
| **Config** | @nestjs/config + dotenv | |

---

## 4. Cấu trúc thư mục

```
SmartGarden/
├── smart-garden-app/                # Backend NestJS
│   ├── prisma/
│   │   ├── schema.prisma            # Schema database
│   │   └── seed.ts                  # Seed tài khoản admin
│   ├── prisma.config.ts             # Cấu hình Prisma 7
│   ├── src/
│   │   ├── main.ts                  # Entry point (Swagger, ValidationPipe, CORS)
│   │   ├── app.module.ts            # Module gốc
│   │   ├── common/
│   │   │   ├── decorators/          # @CurrentUser, @Roles
│   │   │   ├── guards/              # RolesGuard
│   │   │   ├── middleware/          # LoggerMiddleware
│   │   │   └── types/               # AuthUser, Role
│   │   ├── config/                  # Configuration loader
│   │   ├── modules/
│   │   │   ├── auth/                # Đăng ký, đăng nhập, JWT
│   │   │   ├── gardens/             # CRUD vườn + điều khiển LED
│   │   │   ├── vegetables/          # CRUD rau + giá + bán
│   │   │   ├── sensor/              # Dữ liệu cảm biến
│   │   │   └── price/               # Doanh thu, giá theo thời gian
│   │   ├── infrastructure/
│   │   │   └── mqtt/
│   │   │       ├── services/        # MqttBrokerService (publish/subscribe)
│   │   │       ├── controllers/     # MQTT status + command API
│   │   │       └── gateways/        # WebSocket gateway (Socket.IO)
│   │   └── prisma/
│   │       └── prisma.service.ts    # PrismaClient DI
│   ├── test/
│   │   ├── app.e2e-spec.ts          # 75 test E2E
│   │   └── jest-e2e.json
│   ├── .env.example
│   └── package.json
│
└── SmartGarden_ESP/                 # Firmware ESP32
    ├── main/
    │   ├── main.c                   # Logic chính: WiFi, MQTT, LED, Sensor
    │   └── Kconfig.projbuild
    ├── managed_components/          # espressif/cjson, espressif/mqtt
    ├── sdkconfig.defaults
    └── CMakeLists.txt
```

---

## 5. Database Schema

### 5.1 Mô hình quan hệ

```
User (1) ──── (n) Garden
Garden (1) ──── (n) Vegetable
Garden (1) ──── (n) Sale
Garden (1) ──── (n) SensorData
Vegetable (1) ──── (n) VegetablePrice
Vegetable (1) ──── (n) Sale (qua Restrict)
```

### 5.2 Các bảng chi tiết

**User**
| Field | Type | Ghi chú |
|---|---|---|
| id | String (CUID) | PK |
| name | String | Tên người dùng |
| email | String | Unique |
| password | String | bcrypt hash |
| role | Enum (admin/user) | Mặc định user |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Garden**
| Field | Type | Ghi chú |
|---|---|---|
| id | String (CUID) | PK |
| name | String | Tên vườn |
| description | String? | Mô tả |
| ownerId | String | FK → User (Cascade) |
| led1State | String | "On"/"Off", mặc định Off |
| led2State | String | |
| led3State | String | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Vegetable**
| Field | Type | Ghi chú |
|---|---|---|
| id | String (CUID) | PK |
| name | String | Unique(gardenId, name) |
| importedQuantity | Int | Số lượng nhập |
| soldQuantity | Int | Số lượng bán |
| currentPrice | Decimal? | Giá hiện tại |
| gardenId | String | FK → Garden (Cascade) |

**VegetablePrice**
| Field | Type | Ghi chú |
|---|---|---|
| id | String (CUID) | PK |
| vegetableId | String | FK → Vegetable (Cascade) |
| price | Decimal(12,2) | Giá |
| effectiveAt | DateTime | Thời điểm áp dụng |

**Sale**
| Field | Type | Ghi chú |
|---|---|---|
| id | String (CUID) | PK |
| gardenId | String | FK → Garden (Cascade) |
| vegetableId | String | FK → Vegetable (Restrict) |
| quantity | Int | Số lượng bán |
| unitPrice | Decimal(12,2) | Đơn giá |
| totalAmount | Decimal(12,2) | Thành tiền |
| soldAt | DateTime | Thời gian bán |

**SensorData**
| Field | Type | Ghi chú |
|---|---|---|
| id | String (CUID) | PK |
| gardenId | String | FK → Garden (Cascade) |
| deviceId | String? | ID thiết bị |
| packetNo | Int? | Số thứ tự gói tin |
| temperature | Float | Nhiệt độ |
| humidity | Float | Độ ẩm |
| payload | Json? | Dữ liệu gốc |
| receivedAt | DateTime | Thời gian nhận |

---

## 6. Chi tiết các module Backend

### 6.1 Module Auth

- **Controller**: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- **Service**: register (hash bcrypt, tạo user, sign JWT), login (verify password, sign JWT)
- **JWT Payload**: `{ sub: userId, email, role }`
- **Strategy**: Passport JWT Strategy — trích xuất từ `Authorization: Bearer <token>`, validate payload
- **Guard**: `JwtAuthGuard` — kiểm tra token hợp lệ
- **Đặc điểm**: Admin chỉ tạo qua seed (`npm run seed`), đăng ký luôn tạo user role `user`

### 6.2 Module Garden

- CRUD gardens
- `POST /gardens/:id/led` — điều khiển 3 đèn LED + publish MQTT command
- `GET /gardens/:id/revenue` — doanh thu vườn (day/week/month)
- `GET /gardens/revenue/all` — tổng doanh thu (admin-only)
- **Phân quyền**: User chỉ thấy/sửa vườn của mình; Admin thấy tất cả

### 6.3 Module Vegetable

- CRUD vegetables (unique constraint: `[gardenId, name]`)
- `POST /vegetables/:id/sell` — bán rau, kiểm tra tồn kho và giá, tạo Sale transaction
- `POST/PUT/DELETE/GET /vegetables/:id/price` — quản lý giá rau
- **Logic bán**: `soldQuantity + quantity <= importedQuantity`, dùng `$transaction` để đảm bảo consistency

### 6.4 Module Sensor

- `POST /sensor-data` — thêm dữ liệu cảm biến
- `GET /sensor-data/:gardenId` — lịch sử (có filter from/to)
- `GET /sensor-data/:gardenId/latest` — bản ghi gần nhất
- `GET /sensor-data/:gardenId/avg-24h` — nhiệt độ/độ ẩm trung bình 24h
- `recordFromDevice()` — public method cho MQTT gateway ghi dữ liệu từ ESP32

### 6.5 Module Price

- `GET /all/price?range=day|week|month` — tổng doanh thu toàn hệ thống (admin)
- `GET /price?range=day|week|month` — danh sách giá theo thời gian
- Aggregate: `totalRevenue`, `totalQuantity`, `saleCount`, `byGarden[]`

### 6.6 Module MQTT Infrastructure

- **MqttBrokerService**: Singleton kết nối HiveMQ broker, publish/subscribe
- **MqttGateway** (Socket.IO): WebSocket server namespace `/smart-garden`
  - Lắng nghe MQTT events → emit real-time qua WebSocket
  - Khi client kết nối: join room `garden:<gardenId>` từ query/auth
  - Khi nhận sensor data: emit `sensorData` event + lưu DB
  - Khi nhận command/ACK/status: emit `ledState` event
- **MqttController**: `GET /mqtt/status`, `POST /mqtt/command`

---

## 7. API Endpoints

### 7.1 Authentication

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/auth/register` | No | Đăng ký (luôn tạo role user) |
| POST | `/auth/login` | No | Đăng nhập, trả JWT |
| GET | `/auth/me` | JWT | Thông tin user hiện tại |

### 7.2 Gardens

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/gardens` | JWT | Tạo vườn |
| GET | `/gardens` | JWT | DS vườn (user: vườn mình, admin: tất cả) |
| GET | `/gardens/:id` | JWT | Chi tiết vườn |
| PATCH | `/gardens/:id` | JWT | Cập nhật vườn |
| DELETE | `/gardens/:id` | JWT | Xóa vườn |
| POST | `/gardens/:id/led` | JWT | Điều khiển LED + publish MQTT |
| GET | `/gardens/:id/revenue` | JWT | Doanh thu vườn |
| GET | `/gardens/revenue/all` | JWT+Admin | Doanh thu toàn bộ |

### 7.3 Vegetables

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/vegetables` | JWT | Thêm rau |
| GET | `/vegetables` | JWT | DS rau |
| PUT | `/vegetables/:id` | JWT | Cập nhật số lượng |
| POST | `/vegetables/:id/sell` | JWT | Bán rau |
| POST | `/vegetables/:id/price` | JWT | Nhập giá |
| PUT | `/vegetables/:id/price` | JWT | Sửa giá |
| DELETE | `/vegetables/:id/price` | JWT | Xóa giá |
| GET | `/vegetables/:id/price` | JWT | Lấy giá |

### 7.4 Sensor Data

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/sensor-data` | JWT | Thêm dữ liệu cảm biến |
| GET | `/sensor-data/:gardenId` | JWT | Lịch sử (query: from, to, limit) |
| GET | `/sensor-data/:gardenId/latest` | JWT | Bản ghi gần nhất |
| GET | `/sensor-data/:gardenId/avg-24h` | JWT | Trung bình 24h |

### 7.5 Price / Revenue

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/price` | JWT | DS giá theo range |
| GET | `/all/price` | JWT+Admin | Tổng doanh thu theo range |

### 7.6 MQTT

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/mqtt/status` | JWT | Trạng thái MQTT broker |
| POST | `/mqtt/command` | JWT | Publish command lên MQTT |

---

## 8. Bảo mật & Phân quyền

### 8.1 Authentication (JWT)

- **Đăng ký**: password hash bằng bcrypt (10 rounds)
- **Đăng nhập**: verify password → sign JWT với secret từ `.env`
- **JWT Strategy**: `passport-jwt` trích xuất từ `Bearer` header, validate payload

### 8.2 Role-based Authorization

- `@RolesGuard` đọc `@Roles('admin', 'user')` từ decorator
- So sánh `request.user.role` với required roles
- **User**: chỉ thao tác trên tài nguyên thuộc sở hữu (ownerId)
- **Admin**: thao tác trên tất cả tài nguyên
- Admin không thể đăng ký qua API — chỉ seed

### 8.3 Validation

- `ValidationPipe` global với `whitelist: true, forbidNonWhitelisted: true`
- class-validator DTOs kiểm tra đầu vào

---

## 9. ESP32 Firmware (IoT)

### 9.1 Chức năng

- **WiFi**: Kết nối WiFi với SSID/password cấu hình
- **MQTT**: Kết nối HiveMQ broker, subscribe topic command, publish sensor data
- **LED**: 3 đèn (đỏ, vàng, xanh) — điều khiển qua MQTT command
- **Sensor**: Mô phỏng nhiệt độ/độ ẩm, publish định kỳ (cấu hình interval)
- **ACK**: Phản hồi trạng thái LED sau khi nhận command

### 9.2 Cấu hình (Kconfig)

| Macro | Giá trị mẫu | Mô tả |
|---|---|---|
| CONFIG_WIFI_SSID | "my-wifi" | Tên WiFi |
| CONFIG_WIFI_PASSWORD | "password" | Mật khẩu WiFi |
| CONFIG_GARDEN_ID | "cmt..." | ID vườn (CUID) |
| CONFIG_USER_ID | "cmt..." | ID user (CUID) |
| CONFIG_MQTT_BROKER_URI | "mqtt://broker.hivemq.com:1883" | MQTT broker |
| CONFIG_SENSOR_PUBLISH_INTERVAL_MS | 5000 | Chu kỳ gửi sensor (ms) |
| CONFIG_LED_RED_GPIO | GPIO_NUM_... | Chân GPIO đèn đỏ |

### 9.3 Luồng hoạt động

```
app_main()
  ├── nvs_flash_init()
  ├── led_init()               # GPIO output
  ├── wifi_init_sta()          # Kết nối WiFi
  ├── mqtt_start()             # MQTT client + subscribe command topic
  └── sensor_task()            # Task: publish sensor data + LED status định kỳ

mqtt_event_handler()
  ├── MQTT_EVENT_CONNECTED → subscribe command topic
  ├── MQTT_EVENT_DATA → handle_mqtt_command()
  │   ├── parse JSON (gardenId, led1State, led2State, led3State)
  │   ├── apply_led_state()   # GPIO set level
  │   └── publish_ack()       # Gửi ACK về server
  └── MQTT_EVENT_DISCONNECTED → log
```

### 9.4 Định dạng dữ liệu

**Sensor data publish** (ESP32 → MQTT → Server):
```json
{
  "gardenId": "cmt...",
  "userId": "cmt...",
  "packet_no": 126,
  "temperature": 28.5,
  "humidity": 60.0,
  "deviceId": "ESP32-SMART-GARDEN-01"
}
```

**Command** (API → MQTT → ESP32):
```json
{
  "gardenId": "cmt...",
  "userId": "cmt...",
  "led1State": "On",
  "led2State": "Off",
  "led3State": "Off"
}
```

**ACK** (ESP32 → MQTT → Server):
```json
{
  "gardenId": "cmt...",
  "userId": "cmt...",
  "led1State": true,
  "led2State": false,
  "led3State": false,
  "led1StateText": "On",
  "led2StateText": "Off",
  "led3StateText": "Off"
}
```

---

## 10. MQTT & WebSocket

### 10.1 MQTT Topics

| Topic | Mô tả | Publisher | Subscriber |
|---|---|---|---|
| `smart-garden/sensors` | Dữ liệu cảm biến | ESP32 | Server |
| `smart-garden/commands` | Lệnh điều khiển | Server/API | ESP32 |
| `smart-garden/ack` | Xác nhận từ ESP32 | ESP32 | Server |
| `smart-garden/status` | Trạng thái LED | ESP32 | Server |

### 10.2 WebSocket Events

| Event | Direction | Mô tả |
|---|---|---|
| `sensorData` | Server → Client | Dữ liệu cảm biến real-time |
| `ledState` | Server → Client | Trạng thái LED / ACK / command |
| `mqttStatus` | Server → Client (khi connect) | Trạng thái MQTT broker |

### 10.3 Luồng Real-time

```
ESP32 publish sensor → HiveMQ → Server subscribe
  → MqttGateway.handleSensorMessage()
    → server.emit('sensorData', ...)  [WebSocket]
    → sensorService.recordFromDevice()  [DB]

User gọi API bật đèn → Server publish command → HiveMQ → ESP32
  → ESP32 nhận command → bật LED → publish ACK → HiveMQ → Server
    → MqttGateway nhận ACK
      → server.emit('ledState', { ack: true, ... }) [WebSocket]
```

---

## 11. Kiểm thử

### 11.1 E2E Test (75 tests)

| Nhóm | Số test | Mô tả |
|---|---|---|
| Auth/Register | 7 | Đăng ký, duplicate, validation, whitelist |
| Auth/Login | 4 | Login đúng/sai, thiếu field |
| Auth/Me | 3 | Token hợp lệ/không hợp lệ/thiếu |
| CRUD Gardens | 13 | CRUD + phân quyền + không tồn tại |
| LED Control | 4 | Bật/tắt đèn + MQTT mock + phân quyền |
| CRUD Vegetables | 10 | CRUD + validation + phân quyền |
| Vegetable Price | 6 | POST/PUT/DELETE/GET giá + 404 khi chưa có |
| Sell | 5 | Bán rau, tồn kho, validation, phân quyền |
| Doanh thu | 7 | Revenue theo garden/all, range day/week/month |
| Sensor Data | 10 | CRUD, latest, avg-24h, admin, phân quyền |
| MQTT + Phân quyền | 5 | Status, command, admin xóa vườn user |

**Kết quả**: 75/75 pass.

### 11.2 Kỹ thuật test

- **Supertest**: HTTP assertions trên NestJS TestingModule
- **Mock MQTT**: `MqttBrokerService` được override với mock Jest
- **DB riêng**: Test dùng database thật, dọn dữ liệu trong `afterAll`
- **ValidationPipe**: Giống production (whitelist, forbidNonWhitelisted, transform)
- **Admin token**: Tạo trực tiếp qua Prisma (không qua register vì admin không thể đăng ký)

---

## 12. Hướng dẫn cài đặt và chạy

### 12.1 Yêu cầu

- Node.js >= 18
- PostgreSQL 17 (hoặc tương thích)
- npm >= 9
- (Optional) ESP-IDF 5.x để build firmware ESP32

### 12.2 Cài đặt Backend

```bash
# 1. Clone và cd vào project
cd SmartGarden/smart-garden-app

# 2. Cài dependencies
npm install

# 3. Tạo database PostgreSQL
psql -U postgres -c "CREATE DATABASE smart_garden;"

# 4. Cấu hình .env (xem .env.example)
# DATABASE_URL="postgresql://postgres:password@localhost:5432/smart_garden"

# 5. Đồng bộ schema Prisma
npx prisma db push

# 6. Seed tài khoản admin (mặc định: admin@smartgarden.com / Admin@12345)
npm run seed

# 7. Chạy dev server
npm run start:dev
```

### 12.3 Chạy test

```bash
npm run test:e2e      # 75 E2E tests
npm run test          # Unit tests
npm run build         # Build production
```

### 12.4 Truy cập

- **API Server**: http://localhost:3000
- **Swagger UI**: http://localhost:3000/api
- **WebSocket**: ws://localhost:3000/smart-garden

### 12.5 Tài khoản mặc định

| Vai trò | Email | Password |
|---|---|---|
| Admin | admin@smartgarden.com | Admin@12345 |
| User | (đăng ký qua API) | (tự đặt) |

---

## 13. Kết luận và hướng phát triển

### 13.1 Kết quả đạt được

- ✓ Hệ thống backend hoàn chỉnh với NestJS + Prisma + PostgreSQL
- ✓ Authentication JWT + Role-based Authorization (Admin/User)
- ✓ CRUD Gardens, Vegetables, Prices, Sales
- ✓ Tính doanh thu theo ngày/tuần/tháng
- ✓ Tích hợp MQTT (HiveMQ) giao tiếp với ESP32
- ✓ WebSocket real-time (Socket.IO) cho dữ liệu cảm biến và trạng thái LED
- ✓ Firmware ESP32 đầy đủ: WiFi, MQTT, LED, sensor mô phỏng
- ✓ Swagger API documentation
- ✓ 75 E2E tests pass
- ✓ Seed admin script
