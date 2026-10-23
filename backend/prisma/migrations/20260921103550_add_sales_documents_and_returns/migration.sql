-- CreateEnum
CREATE TYPE "BusinessQuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BusinessSalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_INVOICED', 'INVOICED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BusinessSalesReturnStatus" AS ENUM ('POSTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BUSINESS_INVOICE_DUE';

-- CreateTable
CREATE TABLE "business_quotations" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "BusinessQuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_quotation_lines" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "business_quotation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_sales_orders" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quotationId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "status" "BusinessSalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_sales_order_lines" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "business_sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_sales_returns" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "BusinessSalesReturnStatus" NOT NULL DEFAULT 'POSTED',
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_sales_return_lines" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,2) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "business_sales_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_quotations_businessId_status_idx" ON "business_quotations"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "business_quotations_businessId_quotationNumber_key" ON "business_quotations"("businessId", "quotationNumber");

-- CreateIndex
CREATE INDEX "business_quotation_lines_productId_idx" ON "business_quotation_lines"("productId");

-- CreateIndex
CREATE INDEX "business_sales_orders_businessId_status_idx" ON "business_sales_orders"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "business_sales_orders_businessId_orderNumber_key" ON "business_sales_orders"("businessId", "orderNumber");

-- CreateIndex
CREATE INDEX "business_sales_order_lines_productId_idx" ON "business_sales_order_lines"("productId");

-- CreateIndex
CREATE INDEX "business_sales_returns_businessId_returnDate_idx" ON "business_sales_returns"("businessId", "returnDate");

-- CreateIndex
CREATE UNIQUE INDEX "business_sales_returns_businessId_returnNumber_key" ON "business_sales_returns"("businessId", "returnNumber");

-- CreateIndex
CREATE INDEX "business_sales_return_lines_productId_idx" ON "business_sales_return_lines"("productId");

-- AddForeignKey
ALTER TABLE "business_quotations" ADD CONSTRAINT "business_quotations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_quotations" ADD CONSTRAINT "business_quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "business_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_quotation_lines" ADD CONSTRAINT "business_quotation_lines_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "business_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_quotation_lines" ADD CONSTRAINT "business_quotation_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "business_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_orders" ADD CONSTRAINT "business_sales_orders_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_orders" ADD CONSTRAINT "business_sales_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "business_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_orders" ADD CONSTRAINT "business_sales_orders_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "business_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_order_lines" ADD CONSTRAINT "business_sales_order_lines_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "business_sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_order_lines" ADD CONSTRAINT "business_sales_order_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "business_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_returns" ADD CONSTRAINT "business_sales_returns_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_returns" ADD CONSTRAINT "business_sales_returns_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "business_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_returns" ADD CONSTRAINT "business_sales_returns_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "business_sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_returns" ADD CONSTRAINT "business_sales_returns_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "business_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_return_lines" ADD CONSTRAINT "business_sales_return_lines_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "business_sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sales_return_lines" ADD CONSTRAINT "business_sales_return_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "business_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
