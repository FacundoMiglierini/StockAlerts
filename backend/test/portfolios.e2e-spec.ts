import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { UsersService } from '../src/modules/users/users.service.js';

const PASSWORD = 'password123';

const ladderBody = (overrides: Record<string, unknown> = {}) => ({
  name: 'Tech',
  recipe: 'DRAWDOWN_LADDER',
  options: { dropPct: 0.2, gainPct: 0.2, entries: 3 },
  rows: [
    { ticker: 'AAPL', market: 'usa', reference: 100 },
    { ticker: 'GGAL', market: 'byma', reference: '5000' },
  ],
  ...overrides,
});

describe('Portfolios (e2e)', () => {
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
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD });
    return res.body.accessToken;
  }

  const post = (path: string, token: string, body: unknown) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);

  beforeEach(async () => {
    await resetDatabase(prisma);
    await usersService.create({ email: 'userA@test.com', password: PASSWORD });
    await usersService.create({ email: 'userB@test.com', password: PASSWORD });
    tokenA = await login('userA@test.com');
    tokenB = await login('userB@test.com');
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/portfolios').expect(401);
    await request(app.getHttpServer())
      .post('/portfolios/preview')
      .send({})
      .expect(401);
  });

  describe('POST /portfolios/preview', () => {
    it('returns the expanded alarms and writes nothing', async () => {
      const res = await post(
        '/portfolios/preview',
        tokenA,
        ladderBody(),
      ).expect(200);

      expect(res.body.errors).toEqual([]);
      expect(res.body.alarms).toHaveLength(6);
      expect(res.body.alarms[0]).toEqual({
        ticker: 'AAPL',
        market: 'USA',
        strategyType: 'MANUAL_THRESHOLD',
        params: { trigger: 80, target: 96 },
        rung: 1,
        phase: 'BUY',
      });
      expect(await prisma.alarm.count()).toBe(0);
      expect(await prisma.portfolio.count()).toBe(0);
    });

    it('reports per-row errors alongside the valid rows instead of failing outright', async () => {
      const res = await post(
        '/portfolios/preview',
        tokenA,
        ladderBody({
          rows: [
            { ticker: 'AAPL', market: 'USA', reference: 100 },
            { ticker: 'AGRO.BA', market: 'BYMA', reference: 100 },
          ],
        }),
      ).expect(200);

      expect(res.body.alarms).toHaveLength(3);
      expect(res.body.errors).toEqual([
        { row: 2, message: expect.stringContaining('".BA"') },
      ]);
    });

    it('rejects an unknown recipe and an oversized import at the envelope level', async () => {
      await post(
        '/portfolios/preview',
        tokenA,
        ladderBody({ recipe: 'NOPE' }),
      ).expect(400);
      await post(
        '/portfolios/preview',
        tokenA,
        ladderBody({
          rows: Array.from({ length: 501 }, () => ({})),
        }),
      ).expect(400);
    });
  });

  describe('POST /portfolios', () => {
    it('creates the portfolio and its alarms, all owned by the caller and linked to it', async () => {
      const res = await post('/portfolios', tokenA, ladderBody()).expect(201);

      expect(res.body).toMatchObject({ name: 'Tech', alarmCount: 6 });

      const alarms = await request(app.getHttpServer())
        .get('/alarms')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(alarms.body).toHaveLength(6);
      for (const alarm of alarms.body) {
        expect(alarm.portfolioId).toBe(res.body.id);
        expect(alarm.strategyType).toBe('MANUAL_THRESHOLD');
        expect(alarm.status).toBe('ACTIVE');
        expect(alarm.notificationStatus).toBe('NOT_NOTIFIED');
      }
      const ggal = alarms.body.filter(
        (a: { ticker: string }) => a.ticker === 'GGAL',
      );
      expect(ggal).toHaveLength(3);
      expect(ggal.every((a: { market: string }) => a.market === 'BYMA')).toBe(
        true,
      );
      expect(
        ggal
          .map((a: { params: unknown }) => a.params)
          .sort(
            (x: { trigger: number }, y: { trigger: number }) =>
              y.trigger - x.trigger,
          ),
      ).toEqual([
        { trigger: 4000, target: 4800 },
        { trigger: 3200, target: 3840 },
        { trigger: 2560, target: 3072 },
      ]);
    });

    it('creates explicit-threshold portfolios 1:1', async () => {
      await post('/portfolios', tokenA, {
        name: 'Manual',
        recipe: 'EXPLICIT_THRESHOLDS',
        rows: [
          { ticker: 'AAPL', market: 'USA', trigger: 150, target: 210 },
          { ticker: 'BTC', market: 'CRYPTO', trigger: 50000, target: 90000 },
        ],
      }).expect(201);

      const alarms = await prisma.alarm.findMany({
        orderBy: { ticker: 'asc' },
      });
      expect(alarms.map((a) => [a.ticker, a.market, a.params])).toEqual([
        ['AAPL', 'USA', { trigger: 150, target: 210 }],
        ['BTC', 'CRYPTO', { trigger: 50000, target: 90000 }],
      ]);
    });

    it('imports a ladder of explicit rows per ticker, with SELL rows waiting only for their target', async () => {
      await post('/portfolios', tokenA, {
        name: 'Migrated',
        recipe: 'EXPLICIT_THRESHOLDS',
        rows: [
          {
            ticker: 'HL',
            market: 'BYMA',
            trigger: '41380',
            target: '49656',
            phase: 'SELL',
          },
          {
            ticker: 'HL',
            market: 'BYMA',
            trigger: '26483.2',
            target: '31779.84',
            phase: '',
          },
        ],
      }).expect(201);

      const alarms = await prisma.alarm.findMany();
      const statusByTrigger = Object.fromEntries(
        alarms.map((a) => [
          (a.params as { trigger: number }).trigger,
          [a.status, a.notificationStatus],
        ]),
      );
      expect(statusByTrigger).toEqual({
        41380: ['ACTIVE', 'NOTIFIED_ONCE'],
        26483.2: ['ACTIVE', 'NOT_NOTIFIED'],
      });
    });

    it('requires a name (only preview tolerates its absence)', async () => {
      await post('/portfolios', tokenA, ladderBody({ name: undefined })).expect(
        400,
      );
      await post('/portfolios', tokenA, ladderBody({ name: '' })).expect(400);
      await post(
        '/portfolios/preview',
        tokenA,
        ladderBody({ name: undefined }),
      ).expect(200);
      expect(await prisma.portfolio.count()).toBe(0);
    });

    it('is all-or-nothing: one invalid row means no portfolio and no alarms', async () => {
      const res = await post(
        '/portfolios',
        tokenA,
        ladderBody({
          rows: [
            { ticker: 'AAPL', market: 'USA', reference: 100 },
            { ticker: 'MSFT', market: 'USA', reference: -1 },
          ],
        }),
      ).expect(400);

      expect(res.body.errors).toEqual([
        { row: 2, message: expect.stringMatching(/^reference:/) },
      ]);
      expect(await prisma.alarm.count()).toBe(0);
      expect(await prisma.portfolio.count()).toBe(0);
    });

    it('returns 409 for a duplicate name for the same user, but allows it for another user', async () => {
      await post('/portfolios', tokenA, ladderBody()).expect(201);
      await post('/portfolios', tokenA, ladderBody()).expect(409);
      await post('/portfolios', tokenB, ladderBody()).expect(201);

      expect(await prisma.portfolio.count()).toBe(2);
      // The rejected duplicate must not have leaked any alarms.
      expect(await prisma.alarm.count()).toBe(12);
    });
  });

  describe('GET /portfolios', () => {
    it("lists only the caller's portfolios with their alarm counts", async () => {
      await post('/portfolios', tokenA, ladderBody({ name: 'A-one' })).expect(
        201,
      );
      await post('/portfolios', tokenB, ladderBody({ name: 'B-one' })).expect(
        201,
      );

      const res = await request(app.getHttpServer())
        .get('/portfolios')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ name: 'A-one', alarmCount: 6 });
    });
  });

  describe('DELETE /portfolios/:id', () => {
    it('deletes the portfolio together with its alarms, leaving unrelated alarms alone', async () => {
      const created = await post('/portfolios', tokenA, ladderBody()).expect(
        201,
      );
      await request(app.getHttpServer())
        .post('/alarms')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          ticker: 'TSLA',
          strategyType: 'MANUAL_THRESHOLD',
          params: { trigger: 100, target: 200 },
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/portfolios/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const remaining = await prisma.alarm.findMany();
      expect(remaining.map((a) => a.ticker)).toEqual(['TSLA']);
      expect(remaining[0].portfolioId).toBeNull();
    });

    it("404s (and deletes nothing) for another user's portfolio", async () => {
      const created = await post('/portfolios', tokenA, ladderBody()).expect(
        201,
      );

      await request(app.getHttpServer())
        .delete(`/portfolios/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);

      expect(await prisma.portfolio.count()).toBe(1);
      expect(await prisma.alarm.count()).toBe(6);
    });
  });
});
