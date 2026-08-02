-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "lastPriceRefreshAt" TIMESTAMP(3),
ADD COLUMN     "symbol" TEXT;
