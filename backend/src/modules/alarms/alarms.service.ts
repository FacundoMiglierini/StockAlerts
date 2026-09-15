import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CreateAlarmDto } from './dto/create-alarm.dto.js';
import { UpdateAlarmDto } from './dto/update-alarm.dto.js';
import { parseStrategyParams } from './strategies/strategy-params.schema.js';
import {
  AlarmStatus,
  Market,
  NotificationStatus,
} from '../../generated/prisma/enums.js';

@Injectable()
export class AlarmsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string) {
    return this.prisma.alarm.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForUser(userId: string, id: string) {
    const alarm = await this.prisma.alarm.findFirst({ where: { id, userId } });
    if (!alarm) {
      throw new NotFoundException('Alarm not found');
    }
    return alarm;
  }

  create(userId: string, dto: CreateAlarmDto) {
    const params = parseStrategyParams(dto.strategyType, dto.params);
    return this.prisma.alarm.create({
      data: {
        userId,
        ticker: dto.ticker.trim().toUpperCase(),
        strategyType: dto.strategyType,
        market: dto.market ?? Market.USA,
        params,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateAlarmDto) {
    const existing = await this.findOneForUser(userId, id);
    const params = dto.params
      ? parseStrategyParams(existing.strategyType, dto.params)
      : undefined;

    // Re-arming (TRIGGERED -> ACTIVE) is terminal for every strategy: a
    // TRIGGERED alarm always carries a non-NOT_NOTIFIED notificationStatus
    // (single_shot's one-time fire, or MANUAL_THRESHOLD's completed
    // BUY->SELL cycle), and the worker's per-strategy evaluate() gates on
    // that status — left stale, a re-armed alarm goes back to ACTIVE in
    // the UI but the worker silently never re-evaluates it. Simply
    // enabling (DISABLED -> ACTIVE) must NOT reset it: MANUAL_THRESHOLD
    // can be disabled mid-cycle (after BUY, before SELL) while still
    // ACTIVE with NOTIFIED_ONCE, and re-enabling should resume that
    // in-progress phase rather than restart it.
    const isRearming =
      dto.status === AlarmStatus.ACTIVE &&
      existing.status === AlarmStatus.TRIGGERED;

    return this.prisma.alarm.update({
      where: { id: existing.id },
      data: {
        ...(params && { params }),
        ...(dto.status && { status: dto.status }),
        ...(isRearming && {
          notificationStatus: NotificationStatus.NOT_NOTIFIED,
          triggeredAt: null,
        }),
      },
    });
  }

  async remove(userId: string, id: string) {
    const existing = await this.findOneForUser(userId, id);
    await this.prisma.alarm.delete({ where: { id: existing.id } });
  }
}
