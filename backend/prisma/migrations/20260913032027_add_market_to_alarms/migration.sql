-- CreateEnum
CREATE TYPE "Market" AS ENUM ('NASDAQ', 'CRYPTO', 'CEDEAR_BYMA');

-- AlterTable
ALTER TABLE "alarms" ADD COLUMN     "market" "Market" NOT NULL DEFAULT 'NASDAQ';
