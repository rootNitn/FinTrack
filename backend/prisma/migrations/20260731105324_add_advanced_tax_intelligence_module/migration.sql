-- CreateEnum
CREATE TYPE "TaxDocumentType" AS ENUM ('SALARY_SLIP', 'FORM16', 'AIS', 'FORM26AS', 'CAPITAL_GAINS_STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxDocumentStatus" AS ENUM ('UPLOADED', 'PARSED', 'VALIDATED', 'FAILED');

-- CreateEnum
CREATE TYPE "CapitalGainAssetType" AS ENUM ('STOCK', 'MUTUAL_FUND', 'PROPERTY', 'GOLD', 'CRYPTO');

-- CreateEnum
CREATE TYPE "CapitalGainTermType" AS ENUM ('SHORT', 'LONG');

-- CreateTable
CREATE TABLE "uploaded_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "TaxDocumentType" NOT NULL,
    "financialYearCode" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "contentEncrypted" BYTEA NOT NULL,
    "checksum" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousVersionId" TEXT,
    "status" "TaxDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "parseErrors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploaded_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_slip_records" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financialYearCode" TEXT NOT NULL,
    "month" TEXT,
    "employeeName" TEXT,
    "employerName" TEXT,
    "pan" TEXT,
    "basicSalary" DECIMAL(14,2),
    "hra" DECIMAL(14,2),
    "specialAllowance" DECIMAL(14,2),
    "conveyance" DECIMAL(14,2),
    "medicalAllowance" DECIMAL(14,2),
    "lta" DECIMAL(14,2),
    "bonus" DECIMAL(14,2),
    "commission" DECIMAL(14,2),
    "employerPf" DECIMAL(14,2),
    "employeePf" DECIMAL(14,2),
    "professionalTax" DECIMAL(14,2),
    "incomeTaxTds" DECIMAL(14,2),
    "grossSalary" DECIMAL(14,2),
    "netSalary" DECIMAL(14,2),
    "otherAllowances" DECIMAL(14,2),
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "rawExtractedJson" JSONB,
    "validationWarnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_slip_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form16_records" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financialYearCode" TEXT NOT NULL,
    "assessmentYear" TEXT,
    "employerName" TEXT,
    "employeeName" TEXT,
    "pan" TEXT,
    "tan" TEXT,
    "grossSalary" DECIMAL(14,2),
    "exemptions" DECIMAL(14,2),
    "deductions" DECIMAL(14,2),
    "professionalTax" DECIMAL(14,2),
    "standardDeduction" DECIMAL(14,2),
    "taxableIncome" DECIMAL(14,2),
    "tdsDeducted" DECIMAL(14,2),
    "taxDeposited" DECIMAL(14,2),
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "rawExtractedJson" JSONB,
    "validationWarnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form16_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ais_records" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financialYearCode" TEXT NOT NULL,
    "salaryIncome" DECIMAL(14,2),
    "interestIncome" DECIMAL(14,2),
    "dividendIncome" DECIMAL(14,2),
    "capitalGainsIncome" DECIMAL(14,2),
    "propertyIncome" DECIMAL(14,2),
    "businessIncome" DECIMAL(14,2),
    "otherIncome" DECIMAL(14,2),
    "taxPaid" DECIMAL(14,2),
    "tdsAmount" DECIMAL(14,2),
    "tcsAmount" DECIMAL(14,2),
    "advanceTax" DECIMAL(14,2),
    "highValueTransactions" JSONB,
    "sftTransactions" JSONB,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "rawExtractedJson" JSONB,
    "validationWarnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ais_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form26as_records" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financialYearCode" TEXT NOT NULL,
    "employerTds" DECIMAL(14,2),
    "bankTds" DECIMAL(14,2),
    "dividendTds" DECIMAL(14,2),
    "propertyTds" DECIMAL(14,2),
    "professionalIncomeTds" DECIMAL(14,2),
    "advanceTax" DECIMAL(14,2),
    "selfAssessmentTax" DECIMAL(14,2),
    "refund" DECIMAL(14,2),
    "totalTaxPaid" DECIMAL(14,2),
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "rawExtractedJson" JSONB,
    "validationWarnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form26as_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capital_gains_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financialYearCode" TEXT NOT NULL,
    "assetType" "CapitalGainAssetType" NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "purchasePrice" DECIMAL(14,2) NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "salePrice" DECIMAL(14,2) NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "brokerage" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stampDuty" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transferCharges" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "holdingPeriodDays" INTEGER NOT NULL,
    "termType" "CapitalGainTermType" NOT NULL,
    "indexedCost" DECIMAL(14,2),
    "gainAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capital_gains_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_tax_calculations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financialYearCode" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advance_tax_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_saving_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financialYearCode" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_saving_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_inflation_indices" (
    "id" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "ciiValue" INTEGER NOT NULL,

    CONSTRAINT "cost_inflation_indices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_capital_gain_rules" (
    "id" TEXT NOT NULL,
    "assetType" "CapitalGainAssetType" NOT NULL,
    "termType" "CapitalGainTermType" NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "exemptionLimit" DECIMAL(14,2),
    "indexationAllowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_capital_gain_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_validation_rules" (
    "id" TEXT NOT NULL,
    "documentType" "TaxDocumentType" NOT NULL,
    "fieldName" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "tolerance" DECIMAL(14,2) NOT NULL DEFAULT 1,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_validation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uploaded_documents_userId_documentType_financialYearCode_idx" ON "uploaded_documents"("userId", "documentType", "financialYearCode");

-- CreateIndex
CREATE UNIQUE INDEX "salary_slip_records_documentId_key" ON "salary_slip_records"("documentId");

-- CreateIndex
CREATE INDEX "salary_slip_records_userId_financialYearCode_idx" ON "salary_slip_records"("userId", "financialYearCode");

-- CreateIndex
CREATE UNIQUE INDEX "form16_records_documentId_key" ON "form16_records"("documentId");

-- CreateIndex
CREATE INDEX "form16_records_userId_financialYearCode_idx" ON "form16_records"("userId", "financialYearCode");

-- CreateIndex
CREATE UNIQUE INDEX "ais_records_documentId_key" ON "ais_records"("documentId");

-- CreateIndex
CREATE INDEX "ais_records_userId_financialYearCode_idx" ON "ais_records"("userId", "financialYearCode");

-- CreateIndex
CREATE UNIQUE INDEX "form26as_records_documentId_key" ON "form26as_records"("documentId");

-- CreateIndex
CREATE INDEX "form26as_records_userId_financialYearCode_idx" ON "form26as_records"("userId", "financialYearCode");

-- CreateIndex
CREATE INDEX "capital_gains_transactions_userId_financialYearCode_idx" ON "capital_gains_transactions"("userId", "financialYearCode");

-- CreateIndex
CREATE INDEX "advance_tax_calculations_userId_financialYearCode_idx" ON "advance_tax_calculations"("userId", "financialYearCode");

-- CreateIndex
CREATE INDEX "tax_saving_plans_userId_financialYearCode_idx" ON "tax_saving_plans"("userId", "financialYearCode");

-- CreateIndex
CREATE UNIQUE INDEX "cost_inflation_indices_year_key" ON "cost_inflation_indices"("year");

-- CreateIndex
CREATE UNIQUE INDEX "tax_capital_gain_rules_assetType_termType_key" ON "tax_capital_gain_rules"("assetType", "termType");

-- CreateIndex
CREATE INDEX "tax_validation_rules_documentType_idx" ON "tax_validation_rules"("documentType");

-- AddForeignKey
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "uploaded_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_slip_records" ADD CONSTRAINT "salary_slip_records_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "uploaded_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_slip_records" ADD CONSTRAINT "salary_slip_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form16_records" ADD CONSTRAINT "form16_records_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "uploaded_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form16_records" ADD CONSTRAINT "form16_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ais_records" ADD CONSTRAINT "ais_records_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "uploaded_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ais_records" ADD CONSTRAINT "ais_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form26as_records" ADD CONSTRAINT "form26as_records_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "uploaded_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form26as_records" ADD CONSTRAINT "form26as_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_gains_transactions" ADD CONSTRAINT "capital_gains_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_tax_calculations" ADD CONSTRAINT "advance_tax_calculations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_saving_plans" ADD CONSTRAINT "tax_saving_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
