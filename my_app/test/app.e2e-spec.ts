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

  let accessToken: string;
  let userId: string;
  let postId: string;

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
    if (userId && accessToken) {
      await request(app.getHttpServer())
        .delete(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`);
    }
    await app.close();
  });

  it('/hello (GET) không cần token', () => {
    return request(app.getHttpServer())
      .get('/hello')
      .expect(200)
      .expect({ message: 'Hello NestJS!' });
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
    expect(response.body.user).toMatchObject({ email: testUser.email });
  });

  it('/auth/login (POST) sai mật khẩu trả về 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: 'sai-mat-khau' })
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

  it('/users/:id (PATCH) cập nhật user', async () => {
    const newEmail = `updated_${Date.now()}@example.com`;
    const response = await request(app.getHttpServer())
      .patch(`/users/${userId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: newEmail })
      .expect(200);

    expect(response.body).toMatchObject({ id: userId, email: newEmail });
    testUser.email = newEmail;
  });

  it('/posts (POST) tạo post gắn với user đăng nhập', async () => {
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

  it('/posts/:id (DELETE) xóa post', () => {
    return request(app.getHttpServer())
      .delete(`/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect({ message: `Đã xóa post với id ${postId}` });
  });
});
