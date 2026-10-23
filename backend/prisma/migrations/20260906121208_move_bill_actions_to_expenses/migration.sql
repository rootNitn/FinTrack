/*
  Warnings:

  - You are about to drop the column `paidDate` on the `investments` table. All the data in the column will be lost.
  - You are about to drop the column `snoozedUntil` on the `investments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "paidDate" TIMESTAMP(3),
ADD COLUMN     "snoozedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "investments" DROP COLUMN "paidDate",
DROP COLUMN "snoozedUntil";
