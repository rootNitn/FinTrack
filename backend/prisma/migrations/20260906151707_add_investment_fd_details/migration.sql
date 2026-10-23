-- CreateEnum
CREATE TYPE "InvestmentFdTenureUnit" AS ENUM ('DAYS', 'MONTHS', 'YEARS');

-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "fdCompounding" "FdCompoundingFrequency",
ADD COLUMN     "fdDepositType" "FdDepositType",
ADD COLUMN     "fdInterestRate" DECIMAL(5,2),
ADD COLUMN     "fdMaturityAmount" DECIMAL(14,2),
ADD COLUMN     "fdTenureUnit" "InvestmentFdTenureUnit",
ADD COLUMN     "fdTenureValue" DECIMAL(8,2);
