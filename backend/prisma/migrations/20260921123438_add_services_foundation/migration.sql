-- CreateEnum
CREATE TYPE "BusinessProjectStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BusinessContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "business_service_clients" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_service_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_service_projects" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "BusinessProjectStatus" NOT NULL DEFAULT 'PLANNED',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "budget" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "hourlyRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_service_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_service_contracts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "status" "BusinessContractStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "fixedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "hourlyRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_service_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_service_timesheets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(8,2) NOT NULL,
    "hourlyRate" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_service_timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_service_expenses" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_service_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_service_clients_businessId_name_idx" ON "business_service_clients"("businessId", "name");

-- CreateIndex
CREATE INDEX "business_service_projects_businessId_status_idx" ON "business_service_projects"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "business_service_projects_businessId_code_key" ON "business_service_projects"("businessId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "business_service_contracts_projectId_contractNumber_key" ON "business_service_contracts"("projectId", "contractNumber");

-- CreateIndex
CREATE INDEX "business_service_timesheets_projectId_workDate_idx" ON "business_service_timesheets"("projectId", "workDate");

-- CreateIndex
CREATE INDEX "business_service_expenses_projectId_expenseDate_idx" ON "business_service_expenses"("projectId", "expenseDate");

-- AddForeignKey
ALTER TABLE "business_service_clients" ADD CONSTRAINT "business_service_clients_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_service_projects" ADD CONSTRAINT "business_service_projects_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_service_projects" ADD CONSTRAINT "business_service_projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "business_service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_service_contracts" ADD CONSTRAINT "business_service_contracts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "business_service_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_service_timesheets" ADD CONSTRAINT "business_service_timesheets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "business_service_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_service_timesheets" ADD CONSTRAINT "business_service_timesheets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_service_expenses" ADD CONSTRAINT "business_service_expenses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "business_service_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
