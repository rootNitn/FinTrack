-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('MANUFACTURING', 'RETAIL', 'SERVICES', 'MIXED');

-- CreateEnum
CREATE TYPE "BusinessAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE', 'INVENTORY');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateTable
CREATE TABLE "business_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "type" "BusinessType" NOT NULL DEFAULT 'MANUFACTURING',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "fiscalYearStart" INTEGER NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_accounts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BusinessAccountType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_journal_entries" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'POSTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_journal_lines" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "business_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_profiles_userId_isActive_idx" ON "business_profiles"("userId", "isActive");

-- CreateIndex
CREATE INDEX "business_accounts_businessId_type_idx" ON "business_accounts"("businessId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "business_accounts_businessId_code_key" ON "business_accounts"("businessId", "code");

-- CreateIndex
CREATE INDEX "business_journal_entries_businessId_entryDate_idx" ON "business_journal_entries"("businessId", "entryDate");

-- CreateIndex
CREATE INDEX "business_journal_entries_businessId_status_idx" ON "business_journal_entries"("businessId", "status");

-- CreateIndex
CREATE INDEX "business_journal_lines_journalEntryId_idx" ON "business_journal_lines"("journalEntryId");

-- CreateIndex
CREATE INDEX "business_journal_lines_accountId_idx" ON "business_journal_lines"("accountId");

-- AddForeignKey
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_accounts" ADD CONSTRAINT "business_accounts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_journal_entries" ADD CONSTRAINT "business_journal_entries_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_journal_lines" ADD CONSTRAINT "business_journal_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "business_journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_journal_lines" ADD CONSTRAINT "business_journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "business_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
