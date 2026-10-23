-- CreateEnum
CREATE TYPE "IncomeSourceMode" AS ENUM ('ACTIVE', 'PASSIVE', 'SEMI_PASSIVE');

-- CreateEnum
CREATE TYPE "IncomeSourceStability" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VARIABLE');

-- CreateEnum
CREATE TYPE "IncomeSourceGrowthPotential" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "income" ADD COLUMN     "incomeSourceProfileId" TEXT;

-- CreateTable
CREATE TABLE "income_sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "incomeMode" "IncomeSourceMode" NOT NULL DEFAULT 'ACTIVE',
    "monthlyAverageAmount" DECIMAL(14,2) NOT NULL,
    "annualAmount" DECIMAL(14,2),
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "stability" "IncomeSourceStability" NOT NULL DEFAULT 'MEDIUM',
    "growthPotential" "IncomeSourceGrowthPotential" NOT NULL DEFAULT 'MEDIUM',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "income_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "income_sources_userId_idx" ON "income_sources"("userId");

-- CreateIndex
CREATE INDEX "income_sources_userId_isActive_idx" ON "income_sources"("userId", "isActive");

-- CreateIndex
CREATE INDEX "income_incomeSourceProfileId_idx" ON "income"("incomeSourceProfileId");

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_incomeSourceProfileId_fkey" FOREIGN KEY ("incomeSourceProfileId") REFERENCES "income_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
