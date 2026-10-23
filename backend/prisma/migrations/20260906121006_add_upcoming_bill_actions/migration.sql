-- AlterTable
ALTER TABLE "credit_card_statements" ADD COLUMN     "snoozedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "paidDate" TIMESTAMP(3),
ADD COLUMN     "snoozedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "credit_card_statements_userId_snoozedUntil_idx" ON "credit_card_statements"("userId", "snoozedUntil");
