-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextRecurrenceDate" TIMESTAMP(3),
ADD COLUMN     "parentInvestmentId" TEXT,
ADD COLUMN     "recurrenceEndDate" TIMESTAMP(3),
ADD COLUMN     "recurrenceInterval" "RecurrenceInterval";

-- CreateIndex
CREATE INDEX "investments_isRecurring_nextRecurrenceDate_idx" ON "investments"("isRecurring", "nextRecurrenceDate");

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_parentInvestmentId_fkey" FOREIGN KEY ("parentInvestmentId") REFERENCES "investments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
