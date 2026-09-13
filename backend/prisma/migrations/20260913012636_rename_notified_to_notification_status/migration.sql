/*
  Warnings:

  - You are about to drop the column `notified` on the `alarms` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('NOT_NOTIFIED', 'NOTIFIED_ONCE', 'NOTIFIED_TWICE');

-- AlterTable
ALTER TABLE "alarms" DROP COLUMN "notified",
ADD COLUMN     "notificationStatus" "NotificationStatus" NOT NULL DEFAULT 'NOT_NOTIFIED';
