-- CreateEnum
CREATE TYPE "BusinessCustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BusinessSalesInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BusinessCreditNoteStatus" AS ENUM ('ISSUED', 'APPLIED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "BusinessStockMovementType" ADD VALUE 'SALES_RETURN';

-- CreateTable
CREATE TABLE "business_customers" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "taxNumber" TEXT,
    "creditLimit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingReceivable" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "BusinessCustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_sales_invoices" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "BusinessSalesInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_sales_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "costPerUnit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "business_sales_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_receivable_payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_receivable_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_credit_notes" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "creditNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BusinessCreditNoteStatus" NOT NULL DEFAULT 'ISSUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_customers_businessId_status_idx" ON "business_customers"("businessId", "status");

-- CreateIndex
CREATE INDEX "business_customers_businessId_name_idx" ON "business_customers"("businessId", "name");

-- CreateIndex
CREATE INDEX "business_sales_invoices_businessId_status_dueDate_idx" ON "business_sales_invoices"("businessId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "business_sales_invoices_customerId_dueDate_idx" ON "business_sales_invoices"("customerId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "business_sales_invoices_businessId_invoiceNumber_key" ON "business_sales_invoices"("businessId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "business_sales_invoice_lines_productId_idx" ON "business_sales_invoice_lines"("productId");

-- CreateIndex
CREATE INDEX "business_receivable_payments_invoiceId_paymentDate_idx" ON "business_receivable_payments"("invoiceId", "paymentDate");

-- CreateIndex
CREATE INDEX "business_credit_notes_businessId_issueDate_idx" ON "business_credit_notes"("businessId", "issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "business_credit_notes_businessId_creditNumber_key" ON "business_credit_notes"("businessId", "creditNumber");

-- AddForeignKey
ALTER TABLE "business_customers" ADD CONSTRAINT "business_customers_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_invoices" ADD CONSTRAINT "business_sales_invoices_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_invoices" ADD CONSTRAINT "business_sales_invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "business_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_invoice_lines" ADD CONSTRAINT "business_sales_invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "business_sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_invoice_lines" ADD CONSTRAINT "business_sales_invoice_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "business_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_receivable_payments" ADD CONSTRAINT "business_receivable_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "business_sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_credit_notes" ADD CONSTRAINT "business_credit_notes_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_credit_notes" ADD CONSTRAINT "business_credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "business_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_credit_notes" ADD CONSTRAINT "business_credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "business_sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
