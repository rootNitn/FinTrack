-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'EMI_DUE';
ALTER TYPE "NotificationType" ADD VALUE 'BUDGET_EXCEEDED';
ALTER TYPE "NotificationType" ADD VALUE 'INSURANCE_RENEWAL';
ALTER TYPE "NotificationType" ADD VALUE 'BIRTHDAY_REMINDER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dateOfBirth" TIMESTAMP(3);
