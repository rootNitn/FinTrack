-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "goalId" TEXT;

-- CreateIndex
CREATE INDEX "investments_goalId_idx" ON "investments"("goalId");

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
