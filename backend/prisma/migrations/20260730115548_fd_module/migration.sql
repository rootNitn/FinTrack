-- CreateEnum
CREATE TYPE "FdBankType" AS ENUM ('PUBLIC', 'PRIVATE', 'SMALL_FINANCE', 'NBFC');

-- CreateEnum
CREATE TYPE "FdDepositType" AS ENUM ('CUMULATIVE', 'MONTHLY_INTEREST', 'QUARTERLY_INTEREST');

-- CreateEnum
CREATE TYPE "FdCompoundingFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "FdPortfolioStatus" AS ENUM ('ACTIVE', 'MATURED', 'CLOSED', 'RENEWED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FD_RATE_CHANGE';
ALTER TYPE "NotificationType" ADD VALUE 'HIGHER_FD_RATE_AVAILABLE';
ALTER TYPE "NotificationType" ADD VALUE 'FD_RENEWAL_REMINDER';

-- CreateTable
CREATE TABLE "fd_banks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "bankType" "FdBankType" NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "minDeposit" DECIMAL(14,2) NOT NULL DEFAULT 1000,
    "maxDeposit" DECIMAL(14,2),
    "depositInsuranceCover" DECIMAL(14,2) NOT NULL DEFAULT 500000,
    "pros" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prematureWithdrawalRules" TEXT,
    "penaltyRules" TEXT,
    "taxInfo" TEXT,
    "customerSupportPhone" TEXT,
    "customerSupportEmail" TEXT,
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fd_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fd_rates" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "tenureLabel" TEXT NOT NULL,
    "tenureMinDays" INTEGER NOT NULL,
    "tenureMaxDays" INTEGER NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,
    "seniorCitizenRate" DECIMAL(5,2) NOT NULL,
    "compounding" "FdCompoundingFrequency" NOT NULL DEFAULT 'QUARTERLY',
    "payoutOptions" TEXT[] DEFAULT ARRAY['CUMULATIVE']::TEXT[],
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fd_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fd_rate_history" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "tenureLabel" TEXT NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fd_rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fd_portfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankId" TEXT,
    "bankName" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,
    "depositType" "FdDepositType" NOT NULL DEFAULT 'CUMULATIVE',
    "compounding" "FdCompoundingFrequency" NOT NULL DEFAULT 'QUARTERLY',
    "openingDate" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "maturityAmount" DECIMAL(14,2) NOT NULL,
    "nominee" TEXT,
    "notes" TEXT,
    "status" "FdPortfolioStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fd_portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fd_calculations" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "principal" DECIMAL(14,2) NOT NULL,
    "fdType" TEXT NOT NULL,
    "depositType" "FdDepositType" NOT NULL,
    "tenureDays" INTEGER NOT NULL,
    "compounding" "FdCompoundingFrequency" NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,
    "maturityAmount" DECIMAL(14,2) NOT NULL,
    "interestEarned" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fd_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fd_favorite_banks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fd_favorite_banks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fd_banks_name_key" ON "fd_banks"("name");

-- CreateIndex
CREATE INDEX "fd_banks_bankType_idx" ON "fd_banks"("bankType");

-- CreateIndex
CREATE INDEX "fd_rates_bankId_idx" ON "fd_rates"("bankId");

-- CreateIndex
CREATE INDEX "fd_rates_tenureMinDays_tenureMaxDays_idx" ON "fd_rates"("tenureMinDays", "tenureMaxDays");

-- CreateIndex
CREATE INDEX "fd_rate_history_bankId_tenureLabel_recordedAt_idx" ON "fd_rate_history"("bankId", "tenureLabel", "recordedAt");

-- CreateIndex
CREATE INDEX "fd_portfolio_userId_idx" ON "fd_portfolio"("userId");

-- CreateIndex
CREATE INDEX "fd_portfolio_userId_status_idx" ON "fd_portfolio"("userId", "status");

-- CreateIndex
CREATE INDEX "fd_portfolio_maturityDate_idx" ON "fd_portfolio"("maturityDate");

-- CreateIndex
CREATE INDEX "fd_calculations_userId_idx" ON "fd_calculations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "fd_favorite_banks_userId_bankId_key" ON "fd_favorite_banks"("userId", "bankId");

-- AddForeignKey
ALTER TABLE "fd_rates" ADD CONSTRAINT "fd_rates_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "fd_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fd_rate_history" ADD CONSTRAINT "fd_rate_history_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "fd_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fd_portfolio" ADD CONSTRAINT "fd_portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fd_portfolio" ADD CONSTRAINT "fd_portfolio_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "fd_banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fd_calculations" ADD CONSTRAINT "fd_calculations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fd_favorite_banks" ADD CONSTRAINT "fd_favorite_banks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fd_favorite_banks" ADD CONSTRAINT "fd_favorite_banks_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "fd_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
