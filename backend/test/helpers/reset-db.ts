import type { PrismaService } from '../../src/common/prisma/prisma.service.js';

// Truncating rather than dropping/recreating: fast, and the schema itself
// (applied once by global-setup.ts) doesn't need to change between tests —
// only the rows in it. CASCADE handles alarms/notification_channels via
// their FK to users.
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users", "alarms", "notification_channels" CASCADE');
}
