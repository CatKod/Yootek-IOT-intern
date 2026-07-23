import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/hello (GET)', () => {
    return request(app.getHttpServer())
      .get('/hello')
      .expect(200)
      .expect({ message: 'Hello NestJS!' });
  });

  it('/users (GET) should return an empty array initially', () => {
    return request(app.getHttpServer()).get('/users').expect(200).expect([]);
  });

  it('/users (POST) should create a user and return it', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Nguyen Van A', email: 'a@example.com' })
      .expect(201);

    expect(response.body).toEqual({
      id: 1,
      name: 'Nguyen Van A',
      email: 'a@example.com',
    });

    await request(app.getHttpServer())
      .get('/users/1')
      .expect(200)
      .expect(response.body);
  });

  it('/users/:id (PATCH) should update a user', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Nguyen Van A', email: 'a@example.com' })
      .expect(201);

    await request(app.getHttpServer())
      .patch('/users/1')
      .send({ email: 'updated@example.com' })
      .expect(200)
      .expect({ id: 1, name: 'Nguyen Van A', email: 'updated@example.com' });
  });

  it('/users/:id (DELETE) should remove a user', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Nguyen Van A', email: 'a@example.com' })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/users/1')
      .expect(200)
      .expect({ message: 'User with id 1 deleted successfully' });

    await request(app.getHttpServer()).get('/users').expect(200).expect([]);
  });

  afterEach(async () => {
    await app.close();
  });
});
