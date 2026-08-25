import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MqttBrokerService } from '../src/infrastructure/mqtt/services/mqtt-broker.service';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(120_000);

describe('SmartGarden API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let publishToCommandTopic: jest.Mock;

  // Dữ liệu dùng chung trong toàn bộ suite
  const suffix = Date.now();
  const admin = { name: 'Quản Trị Viên', email: `admin_${suffix}@test.com`, password: 'admin@12345' };
  const user = { name: 'Nguyễn Văn A', email: `user_${suffix}@test.com`, password: 'user@12345' };
  const otherUser = { name: 'Trần Thị B', email: `other_${suffix}@test.com`, password: 'other@12345' };

  let adminToken: string;
  let userToken: string;
  let otherUserToken: string;
  let adminId: string;
  let userId: string;
  let otherUserId: string;

  let gardenId: string;
  let garden2Id: string;
  let otherGardenId: string;
  let vegetableId: string;
  let vegetable2Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MqttBrokerService)
      .useValue({
        getStatus: () => ({
          connected: false,
          brokerUrl: 'mqtt://mock',
          sensorTopic: 'smart-garden/sensors',
          commandTopic: 'smart-garden/commands',
          ackTopic: 'smart-garden/ack',
          statusTopic: 'smart-garden/status',
        }),
        getSensorTopic: () => 'smart-garden/sensors',
        getCommandTopic: () => 'smart-garden/commands',
        getAckTopic: () => 'smart-garden/ack',
        getStatusTopic: () => 'smart-garden/status',
        onMessage: jest.fn().mockReturnValue(jest.fn()),
        publishToSensorTopic: jest.fn().mockResolvedValue(undefined),
        publishToCommandTopic: jest.fn().mockResolvedValue(undefined),
        publishAck: jest.fn().mockResolvedValue(undefined),
        publish: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.enableShutdownHooks();
    await app.init();

    prisma = app.get(PrismaService);
    publishToCommandTopic = app.get(MqttBrokerService).publishToCommandTopic as jest.Mock;

    // Admin chỉ được tạo qua seed (không qua đăng ký), mô phỏng bằng cách insert trực tiếp
    const adminUser = await prisma.user.create({
      data: {
        name: admin.name,
        email: admin.email,
        password: await bcrypt.hash(admin.password, 10),
        role: 'admin',
      },
      select: { id: true },
    });
    adminId = adminUser.id;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: admin.email, password: admin.password })
      .expect(200);
    adminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    // Dọn dữ liệu test theo thứ tự khoá ngoại
    await prisma.sale.deleteMany({
      where: { garden: { owner: { email: { in: [admin.email, user.email, otherUser.email] } } } },
    });
    await prisma.vegetablePrice.deleteMany({
      where: { vegetable: { garden: { owner: { email: { in: [admin.email, user.email, otherUser.email] } } } } },
    });
    await prisma.vegetable.deleteMany({
      where: { garden: { owner: { email: { in: [admin.email, user.email, otherUser.email] } } } },
    });
    await prisma.sensorData.deleteMany({
      where: { garden: { owner: { email: { in: [admin.email, user.email, otherUser.email] } } } },
    });
    await prisma.garden.deleteMany({
      where: { owner: { email: { in: [admin.email, user.email, otherUser.email] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [admin.email, user.email, otherUser.email] } },
    });

    await app.close();
  });

  const getApp = () => app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================
  describe('POST /auth/register', () => {
    it('đăng ký user mới thành công, trả về user + accessToken', async () => {
      const res = await request(getApp()).post('/auth/register').send(user).expect(201);
      expect(res.body.user.email).toBe(user.email);
      expect(res.body.user.role).toBe('user');
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.accessToken).toBeDefined();
      userId = res.body.user.id;
      userToken = res.body.accessToken;
    });

    it('gửi kèm role: "admin" -> 400 (admin chỉ tạo qua seed)', async () => {
      await request(getApp())
        .post('/auth/register')
        .send({ name: 'Xâm nhập', email: `hacker_${suffix}@test.com`, password: '12345678', role: 'admin' })
        .expect(400);
    });

    it('gửi kèm role không hợp lệ -> 400', async () => {
      await request(getApp())
        .post('/auth/register')
        .send({ name: 'Test', email: `badrole_${suffix}@test.com`, password: '12345678', role: 'superadmin' })
        .expect(400);
    });

    it('đăng ký user thứ hai để kiểm tra phân quyền', async () => {
      const res = await request(getApp()).post('/auth/register').send(otherUser).expect(201);
      otherUserId = res.body.user.id;
      otherUserToken = res.body.accessToken;
    });

    it('email trùng lặp -> 409 Conflict', async () => {
      await request(getApp()).post('/auth/register').send(user).expect(409);
    });

    it('mật khẩu quá ngắn -> 400 Bad Request', async () => {
      await request(getApp())
        .post('/auth/register')
        .send({ name: 'Test', email: `short_${suffix}@test.com`, password: 'short' })
        .expect(400);
    });

    it('email không hợp lệ -> 400 Bad Request', async () => {
      await request(getApp())
        .post('/auth/register')
        .send({ name: 'Test', email: 'khong-phai-email', password: '12345678' })
        .expect(400);
    });

    it('thiếu trường bắt buộc -> 400 Bad Request', async () => {
      await request(getApp()).post('/auth/register').send({ email: user.email }).expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('đăng nhập đúng -> 200, trả về accessToken', async () => {
      const res = await request(getApp())
        .post('/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(user.email);
      userToken = res.body.accessToken;
    });

    it('sai mật khẩu -> 401 Unauthorized', async () => {
      await request(getApp())
        .post('/auth/login')
        .send({ email: user.email, password: 'sai-mat-khau' })
        .expect(401);
    });

    it('email không tồn tại -> 401 Unauthorized', async () => {
      await request(getApp())
        .post('/auth/login')
        .send({ email: `ghost_${suffix}@test.com`, password: '12345678' })
        .expect(401);
    });

    it('thiếu mật khẩu -> 400 Bad Request', async () => {
      await request(getApp()).post('/auth/login').send({ email: user.email }).expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('không có token -> 401', async () => {
      await request(getApp()).get('/auth/me').expect(401);
    });

    it('token không hợp lệ -> 401', async () => {
      await request(getApp()).get('/auth/me').set('Authorization', 'Bearer token-sai').expect(401);
    });

    it('token hợp lệ -> 200, trả về thông tin user', async () => {
      const res = await request(getApp()).get('/auth/me').set('Authorization', auth(userToken)).expect(200);
      expect(res.body.email).toBe(user.email);
      expect(res.body.role).toBe('user');
    });
  });

  // =========================================================================
  // GARDENS
  // =========================================================================
  describe('CRUD /gardens', () => {
    it('không có token -> 401', async () => {
      await request(getApp()).post('/gardens').send({ name: 'Vườn X' }).expect(401);
    });

    it('thiếu name -> 400 Bad Request', async () => {
      await request(getApp())
        .post('/gardens')
        .set('Authorization', auth(userToken))
        .send({ description: 'Không có tên' })
        .expect(400);
    });

    it('user tạo vườn thành công -> 201', async () => {
      const res = await request(getApp())
        .post('/gardens')
        .set('Authorization', auth(userToken))
        .send({ name: 'Vườn Nhà A', description: 'Vườn rau sạch' })
        .expect(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.ownerId).toBe(userId);
      expect(res.body.led1State).toBe('Off');
      gardenId = res.body.id;
    });

    it('user tạo vườn thứ hai', async () => {
      const res = await request(getApp())
        .post('/gardens')
        .set('Authorization', auth(userToken))
        .send({ name: 'Vườn Nhà A 2' })
        .expect(201);
      garden2Id = res.body.id;
    });

    it('user khác tạo vườn của riêng mình', async () => {
      const res = await request(getApp())
        .post('/gardens')
        .set('Authorization', auth(otherUserToken))
        .send({ name: 'Vườn Nhà B' })
        .expect(201);
      otherGardenId = res.body.id;
    });

    it('GET /gardens: user chỉ thấy vườn của mình', async () => {
      const res = await request(getApp()).get('/gardens').set('Authorization', auth(userToken)).expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((g: { id: string }) => g.id)).toContain(gardenId);
      expect(res.body.map((g: { id: string }) => g.id)).not.toContain(otherGardenId);
    });

    it('GET /gardens: admin thấy tất cả vườn', async () => {
      const res = await request(getApp()).get('/gardens').set('Authorization', auth(adminToken)).expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
      expect(res.body.map((g: { id: string }) => g.id)).toContain(otherGardenId);
    });

    it('GET /gardens/:id: chủ vườn truy cập -> 200', async () => {
      const res = await request(getApp()).get(`/gardens/${gardenId}`).set('Authorization', auth(userToken)).expect(200);
      expect(res.body.name).toBe('Vườn Nhà A');
    });

    it('GET /gardens/:id: user khác -> 403 Forbidden', async () => {
      await request(getApp()).get(`/gardens/${gardenId}`).set('Authorization', auth(otherUserToken)).expect(403);
    });

    it('GET /gardens/:id: admin truy cập vườn của user -> 200', async () => {
      await request(getApp()).get(`/gardens/${gardenId}`).set('Authorization', auth(adminToken)).expect(200);
    });

    it('GET /gardens/:id không tồn tại -> 404', async () => {
      await request(getApp())
        .get('/gardens/garden-khong-ton-tai')
        .set('Authorization', auth(adminToken))
        .expect(404);
    });

    it('PATCH /gardens/:id: chủ vườn cập nhật -> 200', async () => {
      const res = await request(getApp())
        .patch(`/gardens/${gardenId}`)
        .set('Authorization', auth(userToken))
        .send({ name: 'Vườn Nhà A (đã sửa)', description: 'Cập nhật' })
        .expect(200);
      expect(res.body.name).toBe('Vườn Nhà A (đã sửa)');
    });

    it('PATCH /gardens/:id: user khác -> 403', async () => {
      await request(getApp())
        .patch(`/gardens/${gardenId}`)
        .set('Authorization', auth(otherUserToken))
        .send({ name: 'Xâm nhập' })
        .expect(403);
    });
  });

  // =========================================================================
  // LED CONTROL (MQTT)
  // =========================================================================
  describe('POST /gardens/:id/led', () => {
    it('bật/tắt đèn thành công -> 201 và publish command MQTT', async () => {
      const res = await request(getApp())
        .post(`/gardens/${gardenId}/led`)
        .set('Authorization', auth(userToken))
        .send({ led1State: 'On', led2State: 'Off', led3State: 'On' })
        .expect(201);
      expect(res.body.led1State).toBe('On');
      expect(res.body.led3State).toBe('On');

      expect(publishToCommandTopic).toHaveBeenCalledWith(
        expect.objectContaining({ gardenId, led1State: 'On', led2State: 'Off', led3State: 'On' }),
        { retain: true },
      );
    });

    it('trạng thái LED không hợp lệ -> 400', async () => {
      await request(getApp())
        .post(`/gardens/${gardenId}/led`)
        .set('Authorization', auth(userToken))
        .send({ led1State: 'ONNN', led2State: 'Off', led3State: 'Off' })
        .expect(400);
    });

    it('thiếu trạng thái LED -> 400', async () => {
      await request(getApp())
        .post(`/gardens/${gardenId}/led`)
        .set('Authorization', auth(userToken))
        .send({ led1State: 'On' })
        .expect(400);
    });

    it('user khác không điều khiển được đèn -> 403', async () => {
      await request(getApp())
        .post(`/gardens/${gardenId}/led`)
        .set('Authorization', auth(otherUserToken))
        .send({ led1State: 'On', led2State: 'Off', led3State: 'Off' })
        .expect(403);
    });
  });

  // =========================================================================
  // VEGETABLES
  // =========================================================================
  describe('CRUD /vegetables', () => {
    it('thêm rau vào vườn của mình -> 201', async () => {
      const res = await request(getApp())
        .post('/vegetables')
        .set('Authorization', auth(userToken))
        .send({ gardenId, name: 'Cải xanh', importedQuantity: 100 })
        .expect(201);
      expect(res.body.name).toBe('Cải xanh');
      expect(res.body.importedQuantity).toBe(100);
      expect(res.body.soldQuantity).toBe(0);
      vegetableId = res.body.id;
    });

    it('thêm rau thứ hai để test bán', async () => {
      const res = await request(getApp())
        .post('/vegetables')
        .set('Authorization', auth(userToken))
        .send({ gardenId, name: 'Xà lách', importedQuantity: 50 })
        .expect(201);
      vegetable2Id = res.body.id;
    });

    it('thêm rau vào vườn của người khác -> 403', async () => {
      await request(getApp())
        .post('/vegetables')
        .set('Authorization', auth(userToken))
        .send({ gardenId: otherGardenId, name: 'Rau trộm' })
        .expect(403);
    });

    it('số lượng âm -> 400', async () => {
      await request(getApp())
        .post('/vegetables')
        .set('Authorization', auth(userToken))
        .send({ gardenId, name: 'Rau âm', importedQuantity: -5 })
        .expect(400);
    });

    it('gardenId không tồn tại -> 404', async () => {
      await request(getApp())
        .post('/vegetables')
        .set('Authorization', auth(userToken))
        .send({ gardenId: 'garden-khong-ton-tai', name: 'Rau ma' })
        .expect(404);
    });

    it('GET /vegetables: user chỉ thấy rau của mình', async () => {
      const res = await request(getApp()).get('/vegetables').set('Authorization', auth(userToken)).expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body.map((v: { id: string }) => v.id)).toContain(vegetableId);
    });

    it('PUT /vegetables/:id: nhập thêm hàng -> 200', async () => {
      const res = await request(getApp())
        .put(`/vegetables/${vegetableId}`)
        .set('Authorization', auth(userToken))
        .send({ importedQuantity: 150 })
        .expect(200);
      expect(res.body.importedQuantity).toBe(150);
    });

    it('PUT /vegetables/:id: soldQuantity > importedQuantity -> 400', async () => {
      await request(getApp())
        .put(`/vegetables/${vegetableId}`)
        .set('Authorization', auth(userToken))
        .send({ importedQuantity: 10, soldQuantity: 20 })
        .expect(400);
    });

    it('PUT /vegetables/:id: user khác -> 403', async () => {
      await request(getApp())
        .put(`/vegetables/${vegetableId}`)
        .set('Authorization', auth(otherUserToken))
        .send({ importedQuantity: 999 })
        .expect(403);
    });

    it('PUT /vegetables/:id không tồn tại -> 404', async () => {
      await request(getApp())
        .put('/vegetables/vegetable-khong-ton-tai')
        .set('Authorization', auth(userToken))
        .send({ importedQuantity: 5 })
        .expect(404);
    });
  });

  // =========================================================================
  // PRICE MANAGEMENT
  // =========================================================================
  describe('Giá rau /vegetables/:id/price', () => {
    it('POST giá lần đầu -> 201', async () => {
      const res = await request(getApp())
        .post(`/vegetables/${vegetableId}/price`)
        .set('Authorization', auth(userToken))
        .send({ price: 25000 })
        .expect(201);
      expect(Number(res.body.price)).toBe(25000);
    });

    it('POST giá âm -> 400', async () => {
      await request(getApp())
        .post(`/vegetables/${vegetableId}/price`)
        .set('Authorization', auth(userToken))
        .send({ price: -1000 })
        .expect(400);
    });

    it('GET giá hiện tại -> 200', async () => {
      const res = await request(getApp())
        .get(`/vegetables/${vegetableId}/price`)
        .set('Authorization', auth(userToken))
        .expect(200);
      expect(Number(res.body.price)).toBe(25000);
    });

    it('PUT giá -> 200, cập nhật giá mới nhất', async () => {
      await request(getApp())
        .put(`/vegetables/${vegetableId}/price`)
        .set('Authorization', auth(userToken))
        .send({ price: 30000 })
        .expect(200);
      const res = await request(getApp())
        .get(`/vegetables/${vegetableId}/price`)
        .set('Authorization', auth(userToken))
        .expect(200);
      expect(Number(res.body.price)).toBe(30000);
    });

    it('user khác không sửa giá được -> 403', async () => {
      await request(getApp())
        .post(`/vegetables/${vegetableId}/price`)
        .set('Authorization', auth(otherUserToken))
        .send({ price: 100 })
        .expect(403);
    });

    it('DELETE giá -> 200, GET sau đó trả 404 (chưa có giá)', async () => {
      await request(getApp())
        .delete(`/vegetables/${vegetableId}/price`)
        .set('Authorization', auth(userToken))
        .expect(200);

      await request(getApp())
        .get(`/vegetables/${vegetableId}/price`)
        .set('Authorization', auth(userToken))
        .expect(404);
    });
  });

  // =========================================================================
  // SELLING (SALE)
  // =========================================================================
  describe('POST /vegetables/:id/sell', () => {
    it('bán khi chưa có giá -> 400', async () => {
      // sau khi delete price ở trên, rau chưa có giá
      await request(getApp())
        .post(`/vegetables/${vegetableId}/sell`)
        .set('Authorization', auth(userToken))
        .send({ quantity: 5 })
        .expect(400);
    });

    it('bán vượt quá số lượng nhập -> 400', async () => {
      await request(getApp())
        .post(`/vegetables/${vegetableId}/price`)
        .set('Authorization', auth(userToken))
        .send({ price: 30000 })
        .expect(201);

      await request(getApp())
        .post(`/vegetables/${vegetableId}/sell`)
        .set('Authorization', auth(userToken))
        .send({ quantity: 9999 })
        .expect(400);
    });

    it('bán thành công -> 201, tạo Sale và trừ tồn kho', async () => {
      const res = await request(getApp())
        .post(`/vegetables/${vegetableId}/sell`)
        .set('Authorization', auth(userToken))
        .send({ quantity: 10 })
        .expect(201);
      expect(res.body.sale.quantity).toBe(10);
      expect(Number(res.body.sale.totalAmount)).toBe(300_000); // 10 * 30000
      expect(res.body.sale.unitPrice).toBeDefined();
      expect(res.body.vegetable.soldQuantity).toBe(10);
    });

    it('quantity không hợp lệ (0, âm, không phải số) -> 400', async () => {
      await request(getApp())
        .post(`/vegetables/${vegetableId}/sell`)
        .set('Authorization', auth(userToken))
        .send({ quantity: 0 })
        .expect(400);

      await request(getApp())
        .post(`/vegetables/${vegetableId}/sell`)
        .set('Authorization', auth(userToken))
        .send({ quantity: -1 })
        .expect(400);

      await request(getApp())
        .post(`/vegetables/${vegetableId}/sell`)
        .set('Authorization', auth(userToken))
        .send({ quantity: 'mot-tram' })
        .expect(400);
    });

    it('bán rau của người khác -> 403', async () => {
      await request(getApp())
        .post(`/vegetables/${vegetableId}/sell`)
        .set('Authorization', auth(otherUserToken))
        .send({ quantity: 1 })
        .expect(403);
    });
  });

  // =========================================================================
  // REVENUE
  // =========================================================================
  describe('Doanh thu', () => {
    it('GET /gardens/:id/revenue của chủ vườn -> 200', async () => {
      const res = await request(getApp())
        .get(`/gardens/${gardenId}/revenue`)
        .set('Authorization', auth(userToken))
        .query({ range: 'day' })
        .expect(200);
      expect(res.body.gardenId).toBe(gardenId);
      expect(Number(res.body.totalRevenue)).toBe(300_000);
    });

    it('GET /gardens/:id/revenue của user khác -> 403', async () => {
      await request(getApp())
        .get(`/gardens/${gardenId}/revenue`)
        .set('Authorization', auth(otherUserToken))
        .query({ range: 'day' })
        .expect(403);
    });

    it('GET /gardens/revenue/all chỉ admin truy cập được -> 200', async () => {
      const res = await request(getApp())
        .get('/gardens/revenue/all')
        .set('Authorization', auth(adminToken))
        .query({ range: 'week' })
        .expect(200);
      expect(res.body.totalRevenue).toBeGreaterThanOrEqual(300_000);
    });

    it('GET /gardens/revenue/all: user -> 403', async () => {
      await request(getApp())
        .get('/gardens/revenue/all')
        .set('Authorization', auth(userToken))
        .query({ range: 'day' })
        .expect(403);
    });

    it('GET /all/price?range=day trả tổng doanh thu toàn hệ thống', async () => {
      const res = await request(getApp())
        .get('/all/price')
        .set('Authorization', auth(adminToken))
        .query({ range: 'day' })
        .expect(200);
      expect(Number(res.body.totalRevenue)).toBeGreaterThanOrEqual(300_000);
      expect(res.body.byGarden).toBeDefined();
    });

    it('GET /price?range=day trả danh sách giá theo thời gian', async () => {
      const res = await request(getApp())
        .get('/price')
        .set('Authorization', auth(userToken))
        .query({ range: 'day' })
        .expect(200);
      expect(Array.isArray(res.body.prices)).toBe(true);
      expect(res.body.prices.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /price?range=week/month cũng hoạt động', async () => {
      await request(getApp()).get('/price').set('Authorization', auth(userToken)).query({ range: 'week' }).expect(200);
      await request(getApp())
        .get('/price')
        .set('Authorization', auth(userToken))
        .query({ range: 'month' })
        .expect(200);
    });
  });

  // =========================================================================
  // SENSOR DATA
  // =========================================================================
  describe('Sensor data /sensor-data', () => {
    it('không có token -> 401', async () => {
      await request(getApp()).post('/sensor-data').send({ gardenId, temperature: 28, humidity: 70 }).expect(401);
    });

    it('thêm dữ liệu cảm biến vào vườn của mình -> 201', async () => {
      const res = await request(getApp())
        .post('/sensor-data')
        .set('Authorization', auth(userToken))
        .send({ gardenId, deviceId: 'ESP32-TEST', packetNo: 1, temperature: 28.5, humidity: 72.3 })
        .expect(201);
      expect(res.body.temperature).toBe(28.5);
      expect(res.body.humidity).toBe(72.3);
    });

    it('thêm dữ liệu cảm biến cho vườn người khác -> 404', async () => {
      await request(getApp())
        .post('/sensor-data')
        .set('Authorization', auth(userToken))
        .send({ gardenId: otherGardenId, temperature: 30, humidity: 60 })
        .expect(404);
    });

    it('thêm với nhiệt độ/độ ẩm không hợp lệ -> 400', async () => {
      await request(getApp())
        .post('/sensor-data')
        .set('Authorization', auth(userToken))
        .send({ gardenId, temperature: 'nóng', humidity: 60 })
        .expect(400);
    });

    it('GET /sensor-data/:gardenId lấy lịch sử', async () => {
      const res = await request(getApp())
        .get(`/sensor-data/${gardenId}`)
        .set('Authorization', auth(userToken))
        .query({ limit: 10 })
        .expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].gardenId).toBe(gardenId);
    });

    it('GET /sensor-data/:gardenId/latest -> 200', async () => {
      const res = await request(getApp())
        .get(`/sensor-data/${gardenId}/latest`)
        .set('Authorization', auth(userToken))
        .expect(200);
      expect(res.body.temperature).toBeDefined();
    });

    it('GET /sensor-data/:gardenId/latest của user không có dữ liệu -> 404', async () => {
      await request(getApp())
        .get(`/sensor-data/${otherGardenId}/latest`)
        .set('Authorization', auth(userToken))
        .expect(404);
    });

    it('GET /sensor-data/:gardenId/avg-24h tính trung bình', async () => {
      const res = await request(getApp())
        .get(`/sensor-data/${gardenId}/avg-24h`)
        .set('Authorization', auth(userToken))
        .expect(200);
      expect(res.body.gardenId).toBe(gardenId);
      expect(res.body.temperature).toBe(28.5);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('admin thêm dữ liệu cảm biến cho vườn bất kỳ -> 201', async () => {
      await request(getApp())
        .post('/sensor-data')
        .set('Authorization', auth(adminToken))
        .send({ gardenId: otherGardenId, temperature: 31.2, humidity: 65.1 })
        .expect(201);
    });

    it('admin xem được dữ liệu của mọi vườn', async () => {
      const res = await request(getApp())
        .get(`/sensor-data/${otherGardenId}/latest`)
        .set('Authorization', auth(adminToken))
        .expect(200);
      expect(res.body.gardenId).toBe(otherGardenId);
      expect(res.body.temperature).toBe(31.2);
    });
  });

  // =========================================================================
  // MQTT RAW API
  // =========================================================================
  describe('MQTT /mqtt', () => {
    it('GET /mqtt/status -> 200', async () => {
      const res = await request(getApp()).get('/mqtt/status').set('Authorization', auth(userToken)).expect(200);
      expect(res.body.brokerUrl).toBe('mqtt://mock');
    });

    it('GET /mqtt/status không có token -> 401', async () => {
      await request(getApp()).get('/mqtt/status').expect(401);
    });

    it('POST /mqtt/command publish command ra broker -> 201', async () => {
      await request(getApp())
        .post('/mqtt/command')
        .set('Authorization', auth(userToken))
        .send({ gardenId, led1State: 'On', led2State: 'On', led3State: 'Off' })
        .expect(201);
      expect(publishToCommandTopic).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // AUTHORIZATION (RBAC) bổ sung
  // =========================================================================
  describe('Phân quyền', () => {
    it('admin xoá được vườn của user', async () => {
      await request(getApp()).delete(`/gardens/${garden2Id}`).set('Authorization', auth(adminToken)).expect(200);
    });

    it('user không thể xoá vườn của người khác', async () => {
      await request(getApp()).delete(`/gardens/${otherGardenId}`).set('Authorization', auth(userToken)).expect(403);
    });
  });
});
