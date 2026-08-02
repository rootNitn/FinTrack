-- CreateEnum
CREATE TYPE "TaxRegimeType" AS ENUM ('OLD', 'NEW');

-- CreateEnum
CREATE TYPE "TaxAgeCategory" AS ENUM ('GENERAL', 'SENIOR', 'SUPER_SENIOR');

-- CreateEnum
CREATE TYPE "TaxEmploymentType" AS ENUM ('SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'PENSIONER');

-- CreateEnum
CREATE TYPE "TaxGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxResidentialStatus" AS ENUM ('RESIDENT', 'NON_RESIDENT', 'RNOR');

-- CreateTable
CREATE TABLE "tax_financial_years" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "assessmentYear" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_financial_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_slabs" (
    "id" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "regime" "TaxRegimeType" NOT NULL,
    "ageCategory" "TaxAgeCategory" NOT NULL DEFAULT 'GENERAL',
    "slabOrder" INTEGER NOT NULL,
    "minIncome" DECIMAL(14,2) NOT NULL,
    "maxIncome" DECIMAL(14,2),
    "ratePercent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "tax_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rebate_rules" (
    "id" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "regime" "TaxRegimeType" NOT NULL,
    "thresholdIncome" DECIMAL(14,2) NOT NULL,
    "maxRebateAmount" DECIMAL(14,2) NOT NULL,
    "marginalReliefEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_rebate_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_surcharge_rules" (
    "id" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "regime" "TaxRegimeType" NOT NULL,
    "slabOrder" INTEGER NOT NULL,
    "minIncome" DECIMAL(14,2) NOT NULL,
    "maxIncome" DECIMAL(14,2),
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "marginalReliefEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_surcharge_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_cess_rules" (
    "id" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Health & Education Cess',
    "ratePercent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "tax_cess_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_deduction_rules" (
    "id" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "regime" "TaxRegimeType" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxLimit" DECIMAL(14,2),
    "ratePercent" DECIMAL(5,2),
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_deduction_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_calculations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financialYearCode" TEXT NOT NULL,
    "label" TEXT,
    "selectedRegime" "TaxRegimeType",
    "inputs" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_financial_years_code_key" ON "tax_financial_years"("code");

-- CreateIndex
CREATE INDEX "tax_slabs_financialYearId_regime_ageCategory_idx" ON "tax_slabs"("financialYearId", "regime", "ageCategory");

-- CreateIndex
CREATE INDEX "tax_rebate_rules_financialYearId_regime_idx" ON "tax_rebate_rules"("financialYearId", "regime");

-- CreateIndex
CREATE INDEX "tax_surcharge_rules_financialYearId_regime_idx" ON "tax_surcharge_rules"("financialYearId", "regime");

-- CreateIndex
CREATE INDEX "tax_cess_rules_financialYearId_idx" ON "tax_cess_rules"("financialYearId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_deduction_rules_financialYearId_regime_code_key" ON "tax_deduction_rules"("financialYearId", "regime", "code");

-- CreateIndex
CREATE INDEX "tax_calculations_userId_idx" ON "tax_calculations"("userId");

-- CreateIndex
CREATE INDEX "tax_calculations_userId_createdAt_idx" ON "tax_calculations"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "tax_slabs" ADD CONSTRAINT "tax_slabs_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "tax_financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rebate_rules" ADD CONSTRAINT "tax_rebate_rules_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "tax_financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_surcharge_rules" ADD CONSTRAINT "tax_surcharge_rules_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "tax_financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_cess_rules" ADD CONSTRAINT "tax_cess_rules_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "tax_financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_deduction_rules" ADD CONSTRAINT "tax_deduction_rules_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "tax_financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
