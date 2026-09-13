import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { UsersService } from '../src/modules/users/users.service.js';

const PASSWORD = 'password123';

describe('Alarms (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usersService: UsersService;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersService = app.get(UsersService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password: PASSWORD });
    return res.body.accessToken;
  }

  async function createAlarm(
    token: string,
    ticker: string,
    strategyType = 'MANUAL_THRESHOLD',
    params: Record<string, number> = { trigger: 100, target: 200 },
  ) {
    const res = await request(app.getHttpServer())
      .post('/alarms')
      .set('Authorization', `Bearer ${token}`)
      .send({ ticker, strategyType, params });
    return res.body;
  }

  beforeEach(async () => {
    await resetDatabase(prisma);
    await usersService.create({ email: 'userA@test.com', password: PASSWORD });
    await usersService.create({ email: 'userB@test.com', password: PASSWORD });
    tokenA = await login('userA@test.com');
    tokenB = await login('userB@test.com');
  });

  it('creates an alarm, normalizing the ticker and defaulting status to ACTIVE', async () => {
    const res = await request(app.getHttpServer())
      .post('/alarms')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ticker: '  aapl ', strategyType: 'MANUAL_THRESHOLD', params: { trigger: 100, target: 200 } })
      .expect(201);

    expect(res.body.ticker).toBe('AAPL');
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.notificationStatus).toBe('NOT_NOTIFIED');
    expect(res.body.market).toBe('USA');
  });

  it('accepts an explicit market other than the USA default', async () => {
    const res = await request(app.getHttpServer())
      .post('/alarms')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        ticker: 'GGAL',
        strategyType: 'MANUAL_THRESHOLD',
        market: 'BYMA',
        params: { trigger: 5400, target: 6200 },
      })
      .expect(201);

    expect(res.body.market).toBe('BYMA');
  });

  it('rejects invalid params for the chosen strategy with a 400, before touching the database', async () => {
    await request(app.getHttpServer())
      .post('/alarms')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ticker: 'AAPL', strategyType: 'RSI', params: { period: -1 } })
      .expect(400);

    const res = await request(app.getHttpServer()).get('/alarms').set('Authorization', `Bearer ${tokenA}`);
    expect(res.body).toHaveLength(0);
  });

  it('only lists the caller’s own alarms', async () => {
    await createAlarm(tokenA, 'AAPL');
    await createAlarm(tokenB, 'MSFT');

    const res = await request(app.getHttpServer())
      .get('/alarms')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].ticker).toBe('AAPL');
  });

  it('404s (not 403) fetching another user’s alarm, so ownership can’t be probed', async () => {
    const alarm = await createAlarm(tokenB, 'MSFT');

    await request(app.getHttpServer())
      .get(`/alarms/${alarm.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('404s updating another user’s alarm, and it is left unchanged', async () => {
    const alarm = await createAlarm(tokenB, 'MSFT');

    await request(app.getHttpServer())
      .patch(`/alarms/${alarm.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'DISABLED' })
      .expect(404);

    const stillActive = await prisma.alarm.findUniqueOrThrow({ where: { id: alarm.id } });
    expect(stillActive.status).toBe('ACTIVE');
  });

  it('404s deleting another user’s alarm, and it still exists afterward', async () => {
    const alarm = await createAlarm(tokenB, 'MSFT');

    await request(app.getHttpServer())
      .delete(`/alarms/${alarm.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    const stillThere = await prisma.alarm.findUnique({ where: { id: alarm.id } });
    expect(stillThere).not.toBeNull();
  });

  it('updates params, re-validated and merged with that strategy’s defaults', async () => {
    const alarm = await createAlarm(tokenA, 'AAPL', 'RSI', { period: 14 });

    const res = await request(app.getHttpServer())
      .patch(`/alarms/${alarm.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ params: { period: 21 } })
      .expect(200);

    expect(res.body.params).toEqual({ period: 21, oversold: 30, overbought: 70 });
  });

  it('deletes an alarm the caller owns', async () => {
    const alarm = await createAlarm(tokenA, 'AAPL');

    await request(app.getHttpServer())
      .delete(`/alarms/${alarm.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const gone = await prisma.alarm.findUnique({ where: { id: alarm.id } });
    expect(gone).toBeNull();
  });

  it('rejects every alarms route without a token', async () => {
    await request(app.getHttpServer()).get('/alarms').expect(401);
    await request(app.getHttpServer()).post('/alarms').send({}).expect(401);
  });
});
