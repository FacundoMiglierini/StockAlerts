import { NotificationChannelsService } from './notification-channels.service.js';
import { NotificationChannelType } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../common/prisma/prisma.service.js';

function createPrismaMock() {
  return {
    notificationChannel: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
}

const USER_ID = 'user-1';

describe('NotificationChannelsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: NotificationChannelsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new NotificationChannelsService(prisma as unknown as PrismaService);
  });

  describe('listForUser', () => {
    it('scopes to the user and only selects type/externalId', async () => {
      prisma.notificationChannel.findMany.mockResolvedValue([]);

      await service.listForUser(USER_ID);

      expect(prisma.notificationChannel.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        select: { type: true, externalId: true },
      });
    });
  });

  describe('link', () => {
    it('upserts on the (userId, type) compound key, so linking twice updates rather than duplicates', async () => {
      await service.link(USER_ID, NotificationChannelType.TELEGRAM, '123456789');

      expect(prisma.notificationChannel.upsert).toHaveBeenCalledWith({
        where: { userId_type: { userId: USER_ID, type: NotificationChannelType.TELEGRAM } },
        create: { userId: USER_ID, type: NotificationChannelType.TELEGRAM, externalId: '123456789' },
        update: { externalId: '123456789' },
      });
    });
  });

  describe('unlink', () => {
    it('deletes by (userId, type), silently succeeding even if nothing was linked', async () => {
      await service.unlink(USER_ID, NotificationChannelType.TELEGRAM);

      expect(prisma.notificationChannel.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, type: NotificationChannelType.TELEGRAM },
      });
    });
  });
});
