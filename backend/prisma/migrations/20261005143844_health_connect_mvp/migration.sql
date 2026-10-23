-- CreateTable
CREATE TABLE "health_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'HEALTH_CONNECT',
    "deviceName" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "enabledMetrics" TEXT[],
    "grantedMetrics" TEXT[],
    "backgroundReadGranted" BOOLEAN NOT NULL DEFAULT false,
    "backgroundReadAvailable" BOOLEAN NOT NULL DEFAULT false,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "generation" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastAttemptedSyncAt" TIMESTAMP(3),
    "syncCompletedAt" TIMESTAMP(3),
    "recordsSynced" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "manualRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_imported_records" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "modifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_imported_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_daily_summaries" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "steps" INTEGER,
    "sleepMinutes" DECIMAL(8,2),
    "exerciseMinutes" DECIMAL(8,2),
    "weightKg" DECIMAL(8,2),
    "averageHeartRate" DECIMAL(8,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_daily_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_sync_runs" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "syncStartedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordsRead" INTEGER NOT NULL,
    "recordsUploaded" INTEGER NOT NULL,
    "recordsSkipped" INTEGER NOT NULL,
    "recordsDeleted" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL,

    CONSTRAINT "health_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "health_connections_userId_key" ON "health_connections"("userId");

-- CreateIndex
CREATE INDEX "health_connections_userId_idx" ON "health_connections"("userId");

-- CreateIndex
CREATE INDEX "health_imported_records_connectionId_startTime_idx" ON "health_imported_records"("connectionId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "health_imported_records_connectionId_metricType_sourceRecor_key" ON "health_imported_records"("connectionId", "metricType", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "health_daily_summaries_connectionId_date_key" ON "health_daily_summaries"("connectionId", "date");

-- CreateIndex
CREATE INDEX "health_sync_runs_connectionId_syncStartedAt_idx" ON "health_sync_runs"("connectionId", "syncStartedAt");

-- CreateIndex
CREATE UNIQUE INDEX "health_sync_runs_connectionId_batchId_key" ON "health_sync_runs"("connectionId", "batchId");

-- AddForeignKey
ALTER TABLE "health_connections" ADD CONSTRAINT "health_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_imported_records" ADD CONSTRAINT "health_imported_records_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "health_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_daily_summaries" ADD CONSTRAINT "health_daily_summaries_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "health_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_sync_runs" ADD CONSTRAINT "health_sync_runs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "health_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
