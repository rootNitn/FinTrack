ALTER TYPE "JournalEntryStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "JournalEntryStatus" ADD VALUE 'REJECTED';

ALTER TABLE "business_journal_entries"
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "approvedByUserId" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "rejectedByUserId" TEXT,
ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "reversalOfId" TEXT;

CREATE UNIQUE INDEX "business_journal_entries_reversalOfId_key"
ON "business_journal_entries"("reversalOfId");

ALTER TABLE "business_journal_entries"
ADD CONSTRAINT "business_journal_entries_reversalOfId_fkey"
FOREIGN KEY ("reversalOfId") REFERENCES "business_journal_entries"("id")
ON DELETE SET NULL ON UPDATE CASCADE;