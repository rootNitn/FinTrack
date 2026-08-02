-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1;
