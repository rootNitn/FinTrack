-- AlterTable
ALTER TABLE "income" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextRecurrenceDate" TIMESTAMP(3),
ADD COLUMN     "parentIncomeId" TEXT,
ADD COLUMN     "recurrenceEndDate" TIMESTAMP(3),
ADD COLUMN     "recurrenceInterval" "RecurrenceInterval";

-- CreateIndex
CREATE INDEX "income_isRecurring_nextRecurrenceDate_idx" ON "income"("isRecurring", "nextRecurrenceDate");

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_parentIncomeId_fkey" FOREIGN KEY ("parentIncomeId") REFERENCES "income"("id") ON DELETE SET NULL ON UPDATE CASCADE;
