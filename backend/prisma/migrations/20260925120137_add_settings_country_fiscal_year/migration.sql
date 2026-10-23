-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'IN',
ADD COLUMN     "financialYearStartMonth" INTEGER NOT NULL DEFAULT 4;
