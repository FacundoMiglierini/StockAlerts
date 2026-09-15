import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { UsersService } from '../src/modules/users/users.service.js';

const PASSWORD = 'password123';

describe('Notification channels (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usersService: UsersService;
  let token: string;

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
    await usersService.create({ email: 'user@test.com', password: PASSWORD });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com', password: PASSWORD });
    token = login.body.accessToken;
  });

  it('starts with no channels linked', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me/channels')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('links a channel and it shows up on both the channels list and /users/me', async () => {
    await request(app.getHttpServer())
      .put('/users/me/channels/TELEGRAM')
      .set('Authorization', `Bearer ${token}`)
      .send({ externalId: '123456789' })
      .expect(200);

    const channels = await request(app.getHttpServer())
      .get('/users/me/channels')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(channels.body).toEqual([
      { type: 'TELEGRAM', externalId: '123456789' },
    ]);

    const me = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.body.channels).toEqual([
      { type: 'TELEGRAM', externalId: '123456789' },
    ]);
  });

  it('re-linking the same channel type updates rather than duplicates', async () => {
    await request(app.getHttpServer())
      .put('/users/me/channels/TELEGRAM')
      .set('Authorization', `Bearer ${token}`)
      .send({ externalId: 'old-chat-id' })
      .expect(200);
    await request(app.getHttpServer())
      .put('/users/me/channels/TELEGRAM')
      .set('Authorization', `Bearer ${token}`)
      .send({ externalId: 'new-chat-id' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/users/me/channels')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual([{ type: 'TELEGRAM', externalId: 'new-chat-id' }]);
  });

  it('unlinks a channel', async () => {
    await request(app.getHttpServer())
      .put('/users/me/channels/TELEGRAM')
      .set('Authorization', `Bearer ${token}`)
      .send({ externalId: '123456789' })
      .expect(200);

    await request(app.getHttpServer())
      .delete('/users/me/channels/TELEGRAM')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const res = await request(app.getHttpServer())
      .get('/users/me/channels')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('unlinking a channel that was never linked is a no-op, not an error', async () => {
    await request(app.getHttpServer())
      .delete('/users/me/channels/TELEGRAM')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('rejects an unknown channel type', async () => {
    await request(app.getHttpServer())
      .put('/users/me/channels/DISCORD')
      .set('Authorization', `Bearer ${token}`)
      .send({ externalId: 'x' })
      .expect(400);
  });

  it('one user cannot see or affect another user’s channels', async () => {
    await usersService.create({ email: 'other@test.com', password: PASSWORD });
    const otherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'other@test.com', password: PASSWORD });
    const otherToken = otherLogin.body.accessToken;

    await request(app.getHttpServer())
      .put('/users/me/channels/TELEGRAM')
      .set('Authorization', `Bearer ${token}`)
      .send({ externalId: 'user-one-chat-id' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/users/me/channels')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });
});
