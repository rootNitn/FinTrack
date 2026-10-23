-- AlterTable
ALTER TABLE "income" ADD COLUMN     "familyMemberId" TEXT;

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
