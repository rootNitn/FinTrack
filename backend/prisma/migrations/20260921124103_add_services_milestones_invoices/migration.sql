-- CreateTable
CREATE TABLE "business_service_milestones" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_service_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_service_invoices" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_service_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_service_milestones_projectId_dueDate_idx" ON "business_service_milestones"("projectId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "business_service_invoices_projectId_invoiceNumber_key" ON "business_service_invoices"("projectId", "invoiceNumber");

-- AddForeignKey
ALTER TABLE "business_service_milestones" ADD CONSTRAINT "business_service_milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "business_service_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_service_invoices" ADD CONSTRAINT "business_service_invoices_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "business_service_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
