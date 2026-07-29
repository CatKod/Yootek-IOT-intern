import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  // Dùng email duy nhất theo thời điểm chạy để không đụng dữ liệu có sẵn trong DB.
  const testUser = {
    name: 'Nguyen Van A',
    email: `e2e_${Date.now()}@example.com`,
    password: '123456',
  };

  const adminLogin = {
    email: 'admin@yootek.com',
    password: '123456',
  };

  let accessToken: string;
  let userId: string;
  let postId: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Áp dụng ValidationPipe giống main.ts để test đúng hành vi thực tế.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    // Dọn dẹp: xóa user vừa tạo (cascade xóa luôn post/profile).
    if (userId && adminToken) {
      await request(app.getHttpServer())
        .delete(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  it('/hello (GET) không cần token', () => {
    return request(app.getHttpServer())
      .get('/hello')
      .expect(200)
      .expect({ message: 'Hello NestJS!' });
  });

  // Auth: đăng nhập admin seed để test role admin cho các API nhạy cảm.
  it('/auth/login (POST) admin login thành công', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send(adminLogin)
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      email: adminLogin.email,
      role: 'admin',
    });

    adminToken = response.body.accessToken;
  });

  it('/users (GET) trả về 401 khi thiếu token', () => {
    return request(app.getHttpServer()).get('/users').expect(401);
  });

  it('/auth/register (POST) tạo user và trả về accessToken', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      name: testUser.name,
      email: testUser.email,
      role: 'user',
    });
    expect(response.body.user.id).toEqual(expect.any(String));
    expect(response.body.user).not.toHaveProperty('password');

    accessToken = response.body.accessToken;
    userId = response.body.user.id;
  });

  it('/auth/register (POST) trả về 409 khi email đã tồn tại', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(409);
  });

  it('/auth/login (POST) đăng nhập thành công', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({ email: testUser.email, role: 'user' });
  });

  // Negative test validation: thiếu field hoặc email sai định dạng phải trả 400.
  it('/auth/register (POST) thiếu thông tin hoặc email sai định dạng trả về 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Thiếu email', password: '123456' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Email sai', email: 'invalid-email', password: '123456' })
      .expect(400);
  });

  // Edge case auth: email chưa tồn tại phải trả 401 Unauthorized.
  it('/auth/login (POST) email chưa đăng ký trả về 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `unknown_${Date.now()}@example.com`, password: '123456' })
      .expect(401);
  });

  // Edge case auth: token giả mạo hoặc không hợp lệ phải bị từ chối.
  it('/auth/me (GET) token giả mạo trả về 401', () => {
    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer fake.invalid.token')
      .expect(401);
  });

  it('/auth/me (GET) trả về thông tin user từ token', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual({ userId, email: testUser.email });
  });

  it('/users/:id (GET) trả về chi tiết user kèm profile & posts', async () => {
    const response = await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: userId,
      name: testUser.name,
      email: testUser.email,
    });
    expect(response.body).not.toHaveProperty('password');
  });

  // Kiểm tra module Profile 1-1: tạo/cập nhật profile gắn đúng userId.
  it('/users/:id/profile (PUT) tạo hoặc cập nhật profile theo user', async () => {
    const profilePayload = {
      bio: 'Backend intern at Yootek',
      avatar: 'https://example.com/avatar.png',
    };

    const response = await request(app.getHttpServer())
      .put(`/users/${userId}/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(profilePayload)
      .expect(200);

    expect(response.body).toMatchObject({
      userId,
      bio: profilePayload.bio,
      avatar: profilePayload.avatar,
    });
  });

  it('/users (GET) trả về danh sách toàn bộ user', async () => {
    const response = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: userId,
          name: testUser.name,
          email: testUser.email,
        }),
      ]),
    );
  });

  // Role-based auth: user thường không được xem danh sách user.
  it('/users (GET) user role bị từ chối với 403', () => {
    return request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  // Role-based auth: user thường không được cập nhật user khác.
  it('/users/:id (PATCH) user role bị từ chối với 403', () => {
    return request(app.getHttpServer())
      .patch(`/users/${userId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: `blocked_${Date.now()}@example.com` })
      .expect(403);
  });

  it('/users/:id (PATCH) admin cập nhật user thành công', async () => {
    const newEmail = `updated_${Date.now()}@example.com`;
    const response = await request(app.getHttpServer())
      .patch(`/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: newEmail })
      .expect(200);

    expect(response.body).toMatchObject({ id: userId, email: newEmail });
    testUser.email = newEmail;
  });

  // User role chỉ được tạo/đọc post, admin thì có toàn quyền.
  it('/posts (POST) user role được tạo bài viết', async () => {
    const response = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Bai viet dau tien', content: 'Xin chao' })
      .expect(201);

    expect(response.body).toMatchObject({
      title: 'Bai viet dau tien',
      content: 'Xin chao',
      userId,
    });
    expect(response.body.id).toEqual(expect.any(String));
    postId = response.body.id;
  });

  // Role-based auth: user thường không được tạo user khác.
  it('/users (POST) user role bị từ chối với 403', () => {
    return request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Not allowed', email: `no_${Date.now()}@example.com`, password: '123456' })
      .expect(403);
  });

  // Negative test validation: bỏ trống title phải trả về 400 Bad Request.
  it('/posts (POST) thiếu title trả về 400', () => {
    return request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'No title' })
      .expect(400);
  });

  it('/posts (GET) lấy danh sách tất cả bài viết', async () => {
    const response = await request(app.getHttpServer())
      .get('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: postId,
          title: 'Bai viet dau tien',
          userId,
        }),
      ]),
    );
  });

  it('/posts/:id (GET) trả về post kèm tác giả', async () => {
    const response = await request(app.getHttpServer())
      .get(`/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: postId,
      title: 'Bai viet dau tien',
    });
    expect(response.body.user).toMatchObject({ id: userId });
  });

  // Cập nhật bài viết bằng PATCH cho cả title và content.
  it('/posts/:id (PATCH) cập nhật tiêu đề hoặc nội dung bài viết', async () => {
    const updatedPayload = {
      title: 'Bai viet da cap nhat',
      content: 'Noi dung da duoc chinh sua',
    };

    const response = await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updatedPayload)
      .expect(200);

    expect(response.body).toMatchObject({
      id: postId,
      title: updatedPayload.title,
      content: updatedPayload.content,
    });
  });

  // Role-based auth: user thường không được sửa/xóa post.
  it('/posts/:id (PATCH) user role bị từ chối với 403', () => {
    return request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Khong duoc phep' })
      .expect(403);
  });

  it('/posts/:id (DELETE) user role bị từ chối với 403', () => {
    return request(app.getHttpServer())
      .delete(`/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('/posts/:id (DELETE) admin xóa post thành công', () => {
    return request(app.getHttpServer())
      .delete(`/posts/${postId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect({ message: `Đã xóa post với id ${postId}` });
  });
});
