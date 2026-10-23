-- CreateEnum
CREATE TYPE "BusinessEntryType" AS ENUM ('INVESTMENT', 'INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "business_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "type" "BusinessEntryType" NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_entries_userId_businessName_idx" ON "business_entries"("userId", "businessName");

-- CreateIndex
CREATE INDEX "business_entries_userId_date_idx" ON "business_entries"("userId", "date");

-- AddForeignKey
ALTER TABLE "business_entries" ADD CONSTRAINT "business_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
