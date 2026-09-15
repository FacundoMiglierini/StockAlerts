import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { NotificationChannelType } from '../../generated/prisma/enums.js';

@Injectable()
export class NotificationChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.notificationChannel.findMany({
      where: { userId },
      select: { type: true, externalId: true },
    });
  }

  link(userId: string, type: NotificationChannelType, externalId: string) {
    return this.prisma.notificationChannel.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, externalId },
      update: { externalId },
    });
  }

  async unlink(userId: string, type: NotificationChannelType) {
    await this.prisma.notificationChannel.deleteMany({
      where: { userId, type },
    });
  }
}
