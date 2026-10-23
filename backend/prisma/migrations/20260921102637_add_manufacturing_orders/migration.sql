-- CreateEnum
CREATE TYPE "BusinessPurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BusinessProductionOrderStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "business_purchase_orders" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "BusinessPurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "expectedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_purchase_order_lines" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderedQuantity" DECIMAL(14,3) NOT NULL,
    "receivedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "business_purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_production_orders" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "status" "BusinessProductionOrderStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedQuantity" DECIMAL(14,3) NOT NULL,
    "producedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_purchase_orders_businessId_status_idx" ON "business_purchase_orders"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "business_purchase_orders_businessId_orderNumber_key" ON "business_purchase_orders"("businessId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "business_purchase_order_lines_purchaseOrderId_productId_key" ON "business_purchase_order_lines"("purchaseOrderId", "productId");

-- CreateIndex
CREATE INDEX "business_production_orders_businessId_status_idx" ON "business_production_orders"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "business_production_orders_businessId_orderNumber_key" ON "business_production_orders"("businessId", "orderNumber");

-- AddForeignKey
ALTER TABLE "business_purchase_orders" ADD CONSTRAINT "business_purchase_orders_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_purchase_orders" ADD CONSTRAINT "business_purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "business_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_purchase_order_lines" ADD CONSTRAINT "business_purchase_order_lines_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "business_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_purchase_order_lines" ADD CONSTRAINT "business_purchase_order_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "business_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_production_orders" ADD CONSTRAINT "business_production_orders_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_production_orders" ADD CONSTRAINT "business_production_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "business_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_production_orders" ADD CONSTRAINT "business_production_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "business_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_production_orders" ADD CONSTRAINT "business_production_orders_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "business_boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
