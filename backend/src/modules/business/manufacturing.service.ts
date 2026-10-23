import { BusinessAccountType, BusinessProductType, BusinessProductionOrderStatus, BusinessStockMovementType, BusinessPurchaseOrderStatus, BusinessType, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { ownedBusiness as ownedBusinessWithType } from "./business-access.util";
import { assertBusinessPeriodOpen } from "./business-controls.service";
import { createBusinessJournalEntry } from "./business-journal.util";
import {
  CreateBomInput,
  CreateProductInput,
  CreateStockMovementInput,
  CreateSupplierInput,
  CreateWarehouseInput,
  UpdateProductInput,
} from "./manufacturing.dto";
import {
  CompleteProductionOrderInput,
  CreateProductionOrderInput,
  CreatePurchaseOrderInput,
  ReceivePurchaseOrderInput,
  TransferStockInput,
} from "./manufacturing-orders.dto";

const INBOUND = new Set<BusinessStockMovementType>([
  BusinessStockMovementType.PURCHASE,
  BusinessStockMovementType.PRODUCTION_RECEIPT,
  BusinessStockMovementType.ADJUSTMENT_IN,
  BusinessStockMovementType.TRANSFER_IN,
]);

const CLOSED_PURCHASE_STATUSES = new Set<BusinessPurchaseOrderStatus>([
  BusinessPurchaseOrderStatus.RECEIVED,
  BusinessPurchaseOrderStatus.CANCELLED,
]);

const CLOSED_PRODUCTION_STATUSES = new Set<BusinessProductionOrderStatus>([
  BusinessProductionOrderStatus.COMPLETED,
  BusinessProductionOrderStatus.CANCELLED,
]);

const round2 = (value: number) => Number(value.toFixed(2));
const round3 = (value: number) => Number(value.toFixed(3));

async function ownedBusiness(userId: string, businessId: string) {
  return ownedBusinessWithType(userId, businessId, [BusinessType.MANUFACTURING]);
}

async function ensureReferences(userId: string, input: { businessId: string; productId?: string; warehouseId?: string; supplierId?: string | null }) {
  await ownedBusiness(userId, input.businessId);
  const [product, warehouse, supplier] = await Promise.all([
    input.productId ? prisma.businessProduct.findFirst({ where: { id: input.productId, businessId: input.businessId, isActive: true } }) : null,
    input.warehouseId ? prisma.businessWarehouse.findFirst({ where: { id: input.warehouseId, businessId: input.businessId, isActive: true } }) : null,
    input.supplierId ? prisma.businessSupplier.findFirst({ where: { id: input.supplierId, businessId: input.businessId, isActive: true } }) : null,
  ]);
  if (input.productId && !product) throw AppError.badRequest("Product does not belong to this business");
  if (input.warehouseId && !warehouse) throw AppError.badRequest("Warehouse does not belong to this business");
  if (input.supplierId && !supplier) throw AppError.badRequest("Supplier does not belong to this business");
  return { product, warehouse, supplier };
}

function movementDelta(type: BusinessStockMovementType, quantity: number) {
  return INBOUND.has(type) ? quantity : -quantity;
}

async function postStockJournal(tx: Prisma.TransactionClient, input: CreateStockMovementInput, product: { type: BusinessProductType }) {
  const accounts = await tx.businessAccount.findMany({ where: { businessId: input.businessId, code: { in: ["1200", "1300", "1400", "2000", "5000", "6000"] } } });
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  const inventoryCode = product.type === BusinessProductType.RAW_MATERIAL || product.type === BusinessProductType.CONSUMABLE ? "1200" : product.type === BusinessProductType.WORK_IN_PROGRESS ? "1300" : "1400";
  const amount = new Prisma.Decimal(input.quantity).mul(input.unitCost);
  let debitCode = inventoryCode;
  let creditCode = input.type === BusinessStockMovementType.PURCHASE ? "2000" : inventoryCode;
  if (input.type === BusinessStockMovementType.ISSUE) { debitCode = "1300"; creditCode = "1200"; }
  if (input.type === BusinessStockMovementType.SALE_ISSUE) { debitCode = "5000"; creditCode = "1400"; }
  if (input.type === BusinessStockMovementType.SALES_RETURN) { debitCode = "1400"; creditCode = "5000"; }
  if (input.type === BusinessStockMovementType.PRODUCTION_RECEIPT) { debitCode = "1400"; creditCode = "1300"; }
  if (input.type === BusinessStockMovementType.ADJUSTMENT_OUT) { debitCode = "6000"; creditCode = inventoryCode; }
  const debit = byCode.get(debitCode);
  const credit = byCode.get(creditCode);
  if (!debit || !credit) throw AppError.badRequest("Business chart of accounts is missing inventory accounts");
  await createBusinessJournalEntry(tx, {
    businessId: input.businessId,
    entryDate: input.movementDate,
    reference: input.reference,
    description: `Stock ${input.type.toLowerCase()} - ${input.productId}`,
    lines: [{ accountId: debit.id, debit: amount, credit: 0 }, { accountId: credit.id, debit: 0, credit: amount }],
  });
}

export async function createMovementInTransaction(
  tx: Prisma.TransactionClient,
  input: CreateStockMovementInput,
  product: { id: string; type: BusinessProductType; unit: string },
) {
  await assertBusinessPeriodOpen(input.businessId, input.movementDate);
  const existing = await tx.businessStockMovement.findMany({
    where: { businessId: input.businessId, productId: input.productId, warehouseId: input.warehouseId },
    select: { type: true, quantity: true },
  });
  const currentStock = existing.reduce((sum, movement) => sum + movementDelta(movement.type, Number(movement.quantity)), 0);
  if (!INBOUND.has(input.type) && currentStock < input.quantity) {
    throw AppError.badRequest(`Insufficient stock. Available: ${round3(currentStock)} ${product.unit}`);
  }
  const movement = await tx.businessStockMovement.create({ data: input, include: { product: true, warehouse: true } });
  await postStockJournal(tx, input, product);
  return movement;
}

export const manufacturingService = {
  async products(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    const products = await prisma.businessProduct.findMany({ where: { businessId, isActive: true }, orderBy: { sku: "asc" }, include: { stockMovements: { select: { type: true, quantity: true, warehouseId: true } } } });
    return products.map((product) => {
      const stock = product.stockMovements.reduce((sum, movement) => sum + movementDelta(movement.type, Number(movement.quantity)), 0);
      return { ...product, stock: round3(stock), stockValue: round2(stock * Number(product.standardCost)), lowStock: stock <= Number(product.reorderLevel) };
    });
  },

  async createProduct(userId: string, input: CreateProductInput) {
    await ownedBusiness(userId, input.businessId);
    if (input.barcode) {
      const duplicate = await prisma.businessProduct.findFirst({ where: { businessId: input.businessId, barcode: input.barcode, isActive: true } });
      if (duplicate) throw AppError.conflict("Barcode already exists in this business");
    }
    return prisma.businessProduct.create({ data: input });
  },

  async updateProduct(userId: string, productId: string, input: UpdateProductInput) {
    const product = await prisma.businessProduct.findFirst({ where: { id: productId, business: { userId }, isActive: true } });
    if (!product) throw AppError.notFound("Product not found");
    if (input.barcode) {
      const duplicate = await prisma.businessProduct.findFirst({ where: { businessId: product.businessId, barcode: input.barcode, id: { not: productId }, isActive: true } });
      if (duplicate) throw AppError.conflict("Barcode already exists in this business");
    }
    return prisma.businessProduct.update({ where: { id: productId }, data: input });
  },

  async suppliers(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessSupplier.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } });
  },

  async createSupplier(userId: string, input: CreateSupplierInput) {
    await ownedBusiness(userId, input.businessId);
    return prisma.businessSupplier.create({ data: input });
  },

  async warehouses(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessWarehouse.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } });
  },

  async createWarehouse(userId: string, input: CreateWarehouseInput) {
    await ownedBusiness(userId, input.businessId);
    return prisma.businessWarehouse.create({ data: input });
  },

  async createMovement(userId: string, input: CreateStockMovementInput) {
    const { product } = await ensureReferences(userId, input);
    if (!product) throw AppError.badRequest("Product is required");
    return prisma.$transaction((tx) => createMovementInTransaction(tx, input, product));
  },

  async movements(userId: string, businessId: string, productId?: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessStockMovement.findMany({ where: { businessId, ...(productId ? { productId } : {}) }, include: { product: true, warehouse: true, supplier: true }, orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }], take: 300 });
  },

  async createBom(userId: string, input: CreateBomInput) {
    await ownedBusiness(userId, input.businessId);
    const products = await prisma.businessProduct.findMany({ where: { businessId: input.businessId, id: { in: [input.productId, ...input.lines.map((line) => line.productId)] }, isActive: true }, select: { id: true } });
    if (products.length !== new Set([input.productId, ...input.lines.map((line) => line.productId)]).size) throw AppError.badRequest("All BOM products must belong to this business");
    return prisma.businessBom.create({ data: { businessId: input.businessId, productId: input.productId, version: input.version, scrapPercent: input.scrapPercent, lines: { create: input.lines } }, include: { product: true, lines: { include: { product: true } } } });
  },

  async boms(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessBom.findMany({ where: { businessId, isActive: true }, include: { product: true, lines: { include: { product: true } } }, orderBy: [{ productId: "asc" }, { version: "desc" }] });
  },

  async createPurchaseOrder(userId: string, input: CreatePurchaseOrderInput) {
    await ownedBusiness(userId, input.businessId);
    const supplier = await prisma.businessSupplier.findFirst({ where: { id: input.supplierId, businessId: input.businessId, isActive: true } });
    const products = await prisma.businessProduct.findMany({ where: { businessId: input.businessId, id: { in: input.lines.map((line) => line.productId) }, isActive: true }, select: { id: true } });
    if (!supplier || products.length !== new Set(input.lines.map((line) => line.productId)).size) throw AppError.badRequest("Supplier and products must belong to this business");
    return prisma.businessPurchaseOrder.create({ data: { businessId: input.businessId, supplierId: input.supplierId, orderNumber: input.orderNumber, expectedDate: input.expectedDate, notes: input.notes, status: BusinessPurchaseOrderStatus.SUBMITTED, lines: { create: input.lines } }, include: { supplier: true, lines: { include: { product: true } } } });
  },

  async purchaseOrders(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessPurchaseOrder.findMany({ where: { businessId }, include: { supplier: true, lines: { include: { product: true } } }, orderBy: { createdAt: "desc" } });
  },

  async receivePurchaseOrder(userId: string, orderId: string, input: ReceivePurchaseOrderInput) {
    const order = await prisma.businessPurchaseOrder.findFirst({ where: { id: orderId, business: { userId } }, include: { lines: { include: { product: true } } } });
    if (!order) throw AppError.notFound("Purchase order not found");
    if (CLOSED_PURCHASE_STATUSES.has(order.status)) throw AppError.badRequest("Purchase order cannot receive more stock");
    const warehouse = await prisma.businessWarehouse.findFirst({ where: { id: input.warehouseId, businessId: order.businessId, isActive: true } });
    if (!warehouse) throw AppError.badRequest("Warehouse does not belong to this business");
    return prisma.$transaction(async (tx) => {
      for (const received of input.received) {
        const line = order.lines.find((item) => item.id === received.lineId);
        if (!line) throw AppError.badRequest("Purchase order line does not belong to this order");
        if (Number(line.receivedQuantity) + received.quantity > Number(line.orderedQuantity)) throw AppError.badRequest(`Received quantity exceeds ordered quantity for ${line.product.name}`);
        await createMovementInTransaction(tx, { businessId: order.businessId, productId: line.productId, warehouseId: input.warehouseId, supplierId: order.supplierId, type: BusinessStockMovementType.PURCHASE, quantity: received.quantity, unitCost: Number(line.unitCost), batchNumber: received.batchNumber, expiryDate: received.expiryDate, reference: order.orderNumber, movementDate: new Date() }, line.product);
        await tx.businessPurchaseOrderLine.update({ where: { id: line.id }, data: { receivedQuantity: { increment: received.quantity } } });
      }
      const updated = await tx.businessPurchaseOrder.findUniqueOrThrow({ where: { id: order.id }, include: { lines: true } });
      const fullyReceived = updated.lines.every((line) => Number(line.receivedQuantity) >= Number(line.orderedQuantity));
      await tx.businessPurchaseOrder.update({ where: { id: order.id }, data: { status: fullyReceived ? BusinessPurchaseOrderStatus.RECEIVED : BusinessPurchaseOrderStatus.PARTIALLY_RECEIVED } });
      return tx.businessPurchaseOrder.findUniqueOrThrow({ where: { id: order.id }, include: { supplier: true, lines: { include: { product: true } } } });
    });
  },

  async createProductionOrder(userId: string, input: CreateProductionOrderInput) {
    await ownedBusiness(userId, input.businessId);
    const [product, warehouse, bom] = await Promise.all([
      prisma.businessProduct.findFirst({ where: { id: input.productId, businessId: input.businessId, type: BusinessProductType.FINISHED_GOOD, isActive: true } }),
      prisma.businessWarehouse.findFirst({ where: { id: input.warehouseId, businessId: input.businessId, isActive: true } }),
      prisma.businessBom.findFirst({ where: { id: input.bomId, businessId: input.businessId, productId: input.productId, isActive: true } }),
    ]);
    if (!product || !warehouse || !bom) throw AppError.badRequest("Production product, warehouse and active BOM must belong to this business");
    return prisma.businessProductionOrder.create({ data: input, include: { product: true, warehouse: true, bom: { include: { lines: { include: { product: true } } } } } });
  },

  async productionOrders(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessProductionOrder.findMany({ where: { businessId }, include: { product: true, warehouse: true, bom: true }, orderBy: { createdAt: "desc" } });
  },

  async startProductionOrder(userId: string, orderId: string) {
    const order = await prisma.businessProductionOrder.findFirst({ where: { id: orderId, business: { userId } } });
    if (!order) throw AppError.notFound("Production order not found");
    if (order.status !== BusinessProductionOrderStatus.PLANNED) throw AppError.badRequest("Only planned production orders can start");
    return prisma.businessProductionOrder.update({ where: { id: orderId }, data: { status: BusinessProductionOrderStatus.IN_PROGRESS, startedAt: new Date() } });
  },

  async completeProductionOrder(userId: string, orderId: string, input: CompleteProductionOrderInput) {
    const order = await prisma.businessProductionOrder.findFirst({ where: { id: orderId, business: { userId } }, include: { bom: { include: { lines: { include: { product: true } } } }, product: true } });
    if (!order) throw AppError.notFound("Production order not found");
    if (CLOSED_PRODUCTION_STATUSES.has(order.status)) throw AppError.badRequest("Production order is already closed");
    if (input.producedQuantity > Number(order.plannedQuantity)) throw AppError.badRequest("Produced quantity cannot exceed planned quantity");
    return prisma.$transaction(async (tx) => {
      for (const line of order.bom.lines) {
        const quantity = Number(line.quantity) * input.producedQuantity * (1 + Number(order.bom.scrapPercent) / 100);
        await createMovementInTransaction(tx, { businessId: order.businessId, productId: line.productId, warehouseId: order.warehouseId, type: BusinessStockMovementType.ISSUE, quantity, unitCost: Number(line.product.standardCost), reference: order.orderNumber, movementDate: new Date() }, line.product);
      }
      const materialCost = order.bom.lines.reduce((sum, line) => sum + Number(line.quantity) * input.producedQuantity * (1 + Number(order.bom.scrapPercent) / 100) * Number(line.product.standardCost), 0);
      await createMovementInTransaction(tx, { businessId: order.businessId, productId: order.productId, warehouseId: order.warehouseId, type: BusinessStockMovementType.PRODUCTION_RECEIPT, quantity: input.producedQuantity, unitCost: materialCost / input.producedQuantity, reference: order.orderNumber, movementDate: new Date() }, order.product);
      return tx.businessProductionOrder.update({ where: { id: orderId }, data: { status: BusinessProductionOrderStatus.COMPLETED, producedQuantity: input.producedQuantity, completedAt: new Date() }, include: { product: true, warehouse: true } });
    });
  },

  async transferStock(userId: string, input: TransferStockInput) {
    if (input.fromWarehouseId === input.toWarehouseId) throw AppError.badRequest("Source and destination warehouse must be different");
    const { product } = await ensureReferences(userId, { businessId: input.businessId, productId: input.productId, warehouseId: input.fromWarehouseId });
    if (!product) throw AppError.badRequest("Product is required");
    await ensureReferences(userId, { businessId: input.businessId, warehouseId: input.toWarehouseId });
    return prisma.$transaction(async (tx) => {
      await createMovementInTransaction(tx, { businessId: input.businessId, productId: input.productId, warehouseId: input.fromWarehouseId, type: BusinessStockMovementType.TRANSFER_OUT, quantity: input.quantity, unitCost: input.unitCost, reference: input.reference, movementDate: new Date() }, product);
      return createMovementInTransaction(tx, { businessId: input.businessId, productId: input.productId, warehouseId: input.toWarehouseId, type: BusinessStockMovementType.TRANSFER_IN, quantity: input.quantity, unitCost: input.unitCost, reference: input.reference, movementDate: new Date() }, product);
    });
  },

  async expiryAlerts(userId: string, businessId: string, days = 30) {
    await ownedBusiness(userId, businessId);
    const until = new Date();
    until.setDate(until.getDate() + Math.max(1, Math.min(days, 365)));
    return prisma.businessStockMovement.findMany({ where: { businessId, expiryDate: { not: null, lte: until }, type: { in: Array.from(INBOUND) } }, include: { product: true, warehouse: true }, orderBy: { expiryDate: "asc" } });
  },

  async costSheet(userId: string, businessId: string, productId: string, quantity = 1) {
    await ownedBusiness(userId, businessId);
    const bom = await prisma.businessBom.findFirst({ where: { businessId, productId, isActive: true }, orderBy: { version: "desc" }, include: { product: true, lines: { include: { product: true } } } });
    if (!bom) throw AppError.notFound("Active BOM not found");
    const scrapMultiplier = 1 + Number(bom.scrapPercent) / 100;
    const materials = bom.lines.map((line) => ({ productId: line.productId, name: line.product.name, quantity: Number(line.quantity) * quantity * scrapMultiplier, unitCost: Number(line.product.standardCost), total: Number(line.quantity) * quantity * scrapMultiplier * Number(line.product.standardCost) }));
    const materialCost = materials.reduce((sum, line) => sum + line.total, 0);
    return { product: bom.product, version: bom.version, quantity, scrapPercent: Number(bom.scrapPercent), materials, materialCost: round2(materialCost), estimatedUnitCost: round2(materialCost / quantity), laborCost: 0, overheadCost: 0, totalCost: round2(materialCost) };
  },
};
