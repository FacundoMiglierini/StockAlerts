import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { UsersService } from '../src/modules/users/users.service.js';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usersService: UsersService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersService = app.get(UsersService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('logs in with correct credentials and the token works against a protected route', async () => {
    await usersService.create({
      email: 'user@test.com',
      password: 'correct-password',
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'correct-password' })
      .expect(200);

    expect(login.body.accessToken).toEqual(expect.any(String));
    expect(login.body.user).toEqual({
      id: expect.any(String),
      email: 'user@test.com',
      role: 'USER',
    });

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
  });

  it('rejects a wrong password', async () => {
    await usersService.create({
      email: 'user@test.com',
      password: 'correct-password',
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'wrong-password' })
      .expect(401);
  });

  it('rejects an unknown email with the same status as a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@test.com', password: 'x' })
      .expect(401);
  });

  it('rejects a protected route with no token', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('rejects a protected route with a garbage token', async () => {
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });
});
