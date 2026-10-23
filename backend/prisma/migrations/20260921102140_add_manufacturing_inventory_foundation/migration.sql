-- CreateEnum
CREATE TYPE "BusinessProductType" AS ENUM ('RAW_MATERIAL', 'WORK_IN_PROGRESS', 'FINISHED_GOOD', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "BusinessStockMovementType" AS ENUM ('PURCHASE', 'ISSUE', 'PRODUCTION_RECEIPT', 'SALE_ISSUE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateTable
CREATE TABLE "business_products" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BusinessProductType" NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "reorderLevel" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "standardCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sellingPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_suppliers" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "taxNumber" TEXT,
    "openingDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_warehouses" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_stock_movements" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "supplierId" TEXT,
    "type" "BusinessStockMovementType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "reference" TEXT,
    "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_boms" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "scrapPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_bom_lines" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_bom_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_products_businessId_type_idx" ON "business_products"("businessId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "business_products_businessId_sku_key" ON "business_products"("businessId", "sku");

-- CreateIndex
CREATE INDEX "business_suppliers_businessId_name_idx" ON "business_suppliers"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "business_warehouses_businessId_name_key" ON "business_warehouses"("businessId", "name");

-- CreateIndex
CREATE INDEX "business_stock_movements_businessId_movementDate_idx" ON "business_stock_movements"("businessId", "movementDate");

-- CreateIndex
CREATE INDEX "business_stock_movements_productId_warehouseId_idx" ON "business_stock_movements"("productId", "warehouseId");

-- CreateIndex
CREATE INDEX "business_boms_businessId_isActive_idx" ON "business_boms"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "business_boms_businessId_productId_version_key" ON "business_boms"("businessId", "productId", "version");

-- CreateIndex
CREATE INDEX "business_bom_lines_productId_idx" ON "business_bom_lines"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "business_bom_lines_bomId_productId_key" ON "business_bom_lines"("bomId", "productId");

-- AddForeignKey
ALTER TABLE "business_products" ADD CONSTRAINT "business_products_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_suppliers" ADD CONSTRAINT "business_suppliers_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_warehouses" ADD CONSTRAINT "business_warehouses_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_stock_movements" ADD CONSTRAINT "business_stock_movements_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_stock_movements" ADD CONSTRAINT "business_stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "business_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_stock_movements" ADD CONSTRAINT "business_stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "business_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_stock_movements" ADD CONSTRAINT "business_stock_movements_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "business_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_boms" ADD CONSTRAINT "business_boms_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_boms" ADD CONSTRAINT "business_boms_productId_fkey" FOREIGN KEY ("productId") REFERENCES "business_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_bom_lines" ADD CONSTRAINT "business_bom_lines_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "business_boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_bom_lines" ADD CONSTRAINT "business_bom_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "business_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
