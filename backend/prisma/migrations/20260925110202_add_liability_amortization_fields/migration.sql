-- AlterTable
ALTER TABLE "liabilities" ADD COLUMN     "emiAmount" DECIMAL(14,2),
ADD COLUMN     "principalAmount" DECIMAL(14,2),
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "tenureMonths" INTEGER;
