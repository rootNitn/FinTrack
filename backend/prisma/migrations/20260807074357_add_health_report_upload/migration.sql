-- CreateEnum
CREATE TYPE "HealthReportStatus" AS ENUM ('UPLOADED', 'PARSED', 'FAILED', 'PASSWORD_REQUIRED');

-- CreateEnum
CREATE TYPE "HealthResultFlag" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'UNKNOWN');

-- CreateTable
CREATE TABLE "health_report_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "labName" TEXT,
    "status" "HealthReportStatus" NOT NULL DEFAULT 'UPLOADED',
    "parseErrors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_report_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_report_results" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "unit" TEXT,
    "referenceLow" DECIMAL(12,4),
    "referenceHigh" DECIMAL(12,4),
    "flag" "HealthResultFlag" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_report_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_report_documents_userId_reportDate_idx" ON "health_report_documents"("userId", "reportDate");

-- CreateIndex
CREATE INDEX "health_report_results_userId_testName_idx" ON "health_report_results"("userId", "testName");

-- CreateIndex
CREATE INDEX "health_report_results_reportId_idx" ON "health_report_results"("reportId");

-- AddForeignKey
ALTER TABLE "health_report_documents" ADD CONSTRAINT "health_report_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_report_results" ADD CONSTRAINT "health_report_results_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "health_report_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_report_results" ADD CONSTRAINT "health_report_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
