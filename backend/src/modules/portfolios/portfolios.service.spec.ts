import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PortfoliosService } from './portfolios.service.js';
import { RecipeType } from './recipes/expand-recipe.js';
import type { PrismaService } from '../../common/prisma/prisma.service.js';

function createPrismaMock() {
  const tx = {
    portfolio: { create: vi.fn() },
    alarm: { createMany: vi.fn() },
  };
  return {
    tx,
    portfolio: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    // Runs the callback against the tx mock, like Prisma's interactive
    // transactions do.
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
}

const USER_ID = 'user-1';

const LADDER_DTO = {
  name: 'Tech',
  recipe: RecipeType.DRAWDOWN_LADDER,
  rows: [{ ticker: 'AAPL', market: 'USA', reference: 100 }],
  options: { dropPct: 0.2, gainPct: 0.2, entries: 2 },
};

describe('PortfoliosService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: PortfoliosService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PortfoliosService(prisma as unknown as PrismaService);
  });

  describe('preview', () => {
    it('returns the plan without touching the database', () => {
      const result = service.preview(LADDER_DTO);

      expect(result.errors).toEqual([]);
      expect(result.alarms).toHaveLength(2);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates the portfolio and all its alarms in one transaction, stripping preview-only fields', async () => {
      prisma.tx.portfolio.create.mockResolvedValue({
        id: 'pf-1',
        userId: USER_ID,
        name: 'Tech',
      });

      const result = await service.create(USER_ID, {
        ...LADDER_DTO,
        name: '  Tech ',
      });

      expect(prisma.tx.portfolio.create).toHaveBeenCalledWith({
        data: { userId: USER_ID, name: 'Tech' },
      });
      expect(prisma.tx.alarm.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: USER_ID,
            portfolioId: 'pf-1',
            ticker: 'AAPL',
            market: 'USA',
            strategyType: 'MANUAL_THRESHOLD',
            params: { trigger: 80, target: 96 },
          },
          {
            userId: USER_ID,
            portfolioId: 'pf-1',
            ticker: 'AAPL',
            market: 'USA',
            strategyType: 'MANUAL_THRESHOLD',
            params: { trigger: 64, target: 76.8 },
          },
        ],
      });
      expect(result).toMatchObject({ id: 'pf-1', alarmCount: 2 });
    });

    it('refuses to write anything when any row is invalid', async () => {
      await expect(
        service.create(USER_ID, {
          ...LADDER_DTO,
          rows: [
            { ticker: 'AAPL', market: 'USA', reference: 100 },
            { ticker: 'MSFT', market: 'NOPE', reference: 100 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a blank name', async () => {
      await expect(
        service.create(USER_ID, { ...LADDER_DTO, name: '   ' }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('turns a unique-name violation into a 409', async () => {
      prisma.$transaction.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
        }),
      );

      await expect(service.create(USER_ID, LADDER_DTO)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows any other database error untouched', async () => {
      const boom = new Error('connection lost');
      prisma.$transaction.mockRejectedValue(boom);

      await expect(service.create(USER_ID, LADDER_DTO)).rejects.toBe(boom);
    });
  });

  describe('findAllForUser', () => {
    it("scopes to the user and flattens Prisma's _count into alarmCount", async () => {
      prisma.portfolio.findMany.mockResolvedValue([
        { id: 'pf-1', name: 'Tech', _count: { alarms: 6 } },
      ]);

      const result = await service.findAllForUser(USER_ID);

      expect(prisma.portfolio.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { alarms: true } } },
      });
      expect(result).toEqual([{ id: 'pf-1', name: 'Tech', alarmCount: 6 }]);
    });
  });

  describe('remove', () => {
    it('deletes a portfolio that belongs to the user', async () => {
      prisma.portfolio.findFirst.mockResolvedValue({ id: 'pf-1' });

      await service.remove(USER_ID, 'pf-1');

      expect(prisma.portfolio.findFirst).toHaveBeenCalledWith({
        where: { id: 'pf-1', userId: USER_ID },
      });
      expect(prisma.portfolio.delete).toHaveBeenCalledWith({
        where: { id: 'pf-1' },
      });
    });

    it("throws NotFound (and deletes nothing) for someone else's portfolio", async () => {
      prisma.portfolio.findFirst.mockResolvedValue(null);

      await expect(service.remove(USER_ID, 'pf-9')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.portfolio.delete).not.toHaveBeenCalled();
    });
  });
});
