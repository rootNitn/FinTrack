-- CreateTable
CREATE TABLE "business_accounting_periods" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_accounting_periods_businessId_startDate_endDate_idx" ON "business_accounting_periods"("businessId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "business_accounting_periods_businessId_period_key" ON "business_accounting_periods"("businessId", "period");

-- AddForeignKey
ALTER TABLE "business_accounting_periods" ADD CONSTRAINT "business_accounting_periods_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
