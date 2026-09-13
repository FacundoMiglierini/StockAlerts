/*
  Warnings:

  - You are about to drop the column `telegramChatId` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "NotificationChannelType" AS ENUM ('TELEGRAM');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "telegramChatId";

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationChannelType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_channels_userId_type_key" ON "notification_channels"("userId", "type");

-- AddForeignKey
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
