-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "broker" TEXT,
ADD COLUMN     "currentNav" DECIMAL(14,4),
ADD COLUMN     "purchaseNav" DECIMAL(14,4),
ADD COLUMN     "source" TEXT DEFAULT 'MANUAL',
ADD COLUMN     "transactionType" TEXT,
ADD COLUMN     "units" DECIMAL(18,4);

-- CreateTable
CREATE TABLE "import_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "totalRecords" INTEGER NOT NULL,
    "importedRecords" INTEGER NOT NULL,
    "skippedRecords" INTEGER NOT NULL,
    "failedRecords" INTEGER NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "importedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_history_userId_idx" ON "import_history"("userId");

-- AddForeignKey
ALTER TABLE "import_history" ADD CONSTRAINT "import_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
