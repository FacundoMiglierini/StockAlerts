import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CreateAlarmDto } from './dto/create-alarm.dto.js';
import { UpdateAlarmDto } from './dto/update-alarm.dto.js';
import { parseStrategyParams } from './strategies/strategy-params.schema.js';
import { Market } from '../../generated/prisma/enums.js';

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
    const params = dto.params ? parseStrategyParams(existing.strategyType, dto.params) : undefined;

    return this.prisma.alarm.update({
      where: { id: existing.id },
      data: {
        ...(params && { params }),
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  async remove(userId: string, id: string) {
    const existing = await this.findOneForUser(userId, id);
    await this.prisma.alarm.delete({ where: { id: existing.id } });
  }
}
