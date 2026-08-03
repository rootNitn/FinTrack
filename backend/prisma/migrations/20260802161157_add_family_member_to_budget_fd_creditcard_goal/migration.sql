-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "familyMemberId" TEXT;

-- AlterTable
ALTER TABLE "credit_cards" ADD COLUMN     "familyMemberId" TEXT;

-- AlterTable
ALTER TABLE "fd_portfolio" ADD COLUMN     "familyMemberId" TEXT;

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "familyMemberId" TEXT;

-- CreateIndex
CREATE INDEX "budgets_familyMemberId_idx" ON "budgets"("familyMemberId");

-- CreateIndex
CREATE INDEX "credit_cards_familyMemberId_idx" ON "credit_cards"("familyMemberId");

-- CreateIndex
CREATE INDEX "fd_portfolio_familyMemberId_idx" ON "fd_portfolio"("familyMemberId");

-- CreateIndex
CREATE INDEX "goals_familyMemberId_idx" ON "goals"("familyMemberId");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fd_portfolio" ADD CONSTRAINT "fd_portfolio_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
