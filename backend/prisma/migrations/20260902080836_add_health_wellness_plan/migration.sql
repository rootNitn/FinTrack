-- CreateTable
CREATE TABLE "health_wellness_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT,
    "focusArea" TEXT,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_wellness_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_wellness_plans_userId_createdAt_idx" ON "health_wellness_plans"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "health_wellness_plans" ADD CONSTRAINT "health_wellness_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_wellness_plans" ADD CONSTRAINT "health_wellness_plans_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "health_report_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
