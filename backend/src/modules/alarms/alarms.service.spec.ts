import { NotFoundException } from '@nestjs/common';
import { AlarmsService } from './alarms.service.js';
import {
  StrategyType,
  AlarmStatus,
  Market,
  NotificationStatus,
} from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../common/prisma/prisma.service.js';

function createPrismaMock() {
  return {
    alarm: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

describe('AlarmsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: AlarmsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AlarmsService(prisma as unknown as PrismaService);
  });

  describe('findAllForUser', () => {
    it('scopes the query to the given user, newest first', async () => {
      prisma.alarm.findMany.mockResolvedValue([]);

      await service.findAllForUser(USER_ID);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOneForUser', () => {
    it('returns the alarm when it belongs to the user', async () => {
      const alarm = { id: 'alarm-1', userId: USER_ID };
      prisma.alarm.findFirst.mockResolvedValue(alarm);

      const result = await service.findOneForUser(USER_ID, 'alarm-1');

      expect(result).toBe(alarm);
      expect(prisma.alarm.findFirst).toHaveBeenCalledWith({
        where: { id: 'alarm-1', userId: USER_ID },
      });
    });

    it('throws NotFoundException when the alarm belongs to a different user', async () => {
      // The query itself is scoped by userId, so another user's alarm just
      // never matches — this is what stops a user from ever learning
      // whether an alarm id exists at all, not a separate ownership check.
      prisma.alarm.findFirst.mockResolvedValue(null);

      await expect(
        service.findOneForUser(OTHER_USER_ID, 'alarm-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('normalizes the ticker and validates params before persisting', () => {
      service.create(USER_ID, {
        ticker: '  aapl ',
        strategyType: StrategyType.MANUAL_THRESHOLD,
        params: { trigger: 150, target: 180 },
      });

      expect(prisma.alarm.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          ticker: 'AAPL',
          strategyType: StrategyType.MANUAL_THRESHOLD,
          market: Market.USA,
          params: { trigger: 150, target: 180 },
        },
      });
    });

    it('defaults market to USA when omitted, but passes through an explicit one', () => {
      service.create(USER_ID, {
        ticker: 'GGAL',
        strategyType: StrategyType.MANUAL_THRESHOLD,
        market: Market.BYMA,
        params: { trigger: 5400, target: 6200 },
      });

      expect(prisma.alarm.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          ticker: 'GGAL',
          strategyType: StrategyType.MANUAL_THRESHOLD,
          market: Market.BYMA,
          params: { trigger: 5400, target: 6200 },
        },
      });
    });

    it('rejects invalid params for the chosen strategy without touching the database', () => {
      expect(() =>
        service.create(USER_ID, {
          ticker: 'AAPL',
          strategyType: StrategyType.RSI,
          params: { period: -1 },
        }),
      ).toThrow();
      expect(prisma.alarm.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('re-validates params against the alarm’s existing strategy type', async () => {
      prisma.alarm.findFirst.mockResolvedValue({
        id: 'alarm-1',
        userId: USER_ID,
        strategyType: StrategyType.RSI,
      });

      await service.update(USER_ID, 'alarm-1', { params: { period: 21 } });

      expect(prisma.alarm.update).toHaveBeenCalledWith({
        where: { id: 'alarm-1' },
        data: { params: { period: 21, oversold: 30, overbought: 70 } },
      });
    });

    it('updates status without requiring params', async () => {
      prisma.alarm.findFirst.mockResolvedValue({
        id: 'alarm-1',
        userId: USER_ID,
        strategyType: StrategyType.RSI,
      });

      await service.update(USER_ID, 'alarm-1', {
        status: AlarmStatus.DISABLED,
      });

      expect(prisma.alarm.update).toHaveBeenCalledWith({
        where: { id: 'alarm-1' },
        data: { status: AlarmStatus.DISABLED },
      });
    });

    it('re-arming a TRIGGERED alarm resets notificationStatus and triggeredAt', async () => {
      prisma.alarm.findFirst.mockResolvedValue({
        id: 'alarm-1',
        userId: USER_ID,
        strategyType: StrategyType.RSI,
        status: AlarmStatus.TRIGGERED,
        notificationStatus: NotificationStatus.NOTIFIED_ONCE,
      });

      await service.update(USER_ID, 'alarm-1', { status: AlarmStatus.ACTIVE });

      expect(prisma.alarm.update).toHaveBeenCalledWith({
        where: { id: 'alarm-1' },
        data: {
          status: AlarmStatus.ACTIVE,
          notificationStatus: NotificationStatus.NOT_NOTIFIED,
          triggeredAt: null,
        },
      });
    });

    it('enabling a DISABLED alarm does not reset notificationStatus, so an in-progress MANUAL_THRESHOLD cycle resumes', async () => {
      prisma.alarm.findFirst.mockResolvedValue({
        id: 'alarm-1',
        userId: USER_ID,
        strategyType: StrategyType.MANUAL_THRESHOLD,
        status: AlarmStatus.DISABLED,
        notificationStatus: NotificationStatus.NOTIFIED_ONCE,
      });

      await service.update(USER_ID, 'alarm-1', { status: AlarmStatus.ACTIVE });

      expect(prisma.alarm.update).toHaveBeenCalledWith({
        where: { id: 'alarm-1' },
        data: { status: AlarmStatus.ACTIVE },
      });
    });

    it('throws NotFoundException before validating params, for an alarm that is not the caller’s', async () => {
      prisma.alarm.findFirst.mockResolvedValue(null);

      await expect(
        service.update(OTHER_USER_ID, 'alarm-1', { params: {} }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.alarm.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes only after confirming ownership', async () => {
      prisma.alarm.findFirst.mockResolvedValue({
        id: 'alarm-1',
        userId: USER_ID,
      });

      await service.remove(USER_ID, 'alarm-1');

      expect(prisma.alarm.delete).toHaveBeenCalledWith({
        where: { id: 'alarm-1' },
      });
    });

    it('does not delete an alarm belonging to another user', async () => {
      prisma.alarm.findFirst.mockResolvedValue(null);

      await expect(service.remove(OTHER_USER_ID, 'alarm-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.alarm.delete).not.toHaveBeenCalled();
    });
  });
});
