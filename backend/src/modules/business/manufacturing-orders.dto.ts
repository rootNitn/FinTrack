import { z } from "zod";
import { BusinessProductionOrderStatus, BusinessPurchaseOrderStatus } from "@prisma/client";

export const purchaseOrderStatusEnum = z.nativeEnum(BusinessPurchaseOrderStatus);
export const productionOrderStatusEnum = z.nativeEnum(BusinessProductionOrderStatus);

const purchaseLineSchema = z.object({
  productId: z.string().uuid(),
  orderedQuantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().min(0),
});

export const createPurchaseOrderSchema = z.object({
  businessId: z.string().uuid(),
  supplierId: z.string().uuid(),
  orderNumber: z.string().trim().min(1).max(50),
  expectedDate: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  lines: z.array(purchaseLineSchema).min(1).max(100),
});

export const receivePurchaseOrderSchema = z.object({
  warehouseId: z.string().uuid(),
  received: z.array(z.object({
    lineId: z.string().uuid(),
    quantity: z.coerce.number().positive(),
    batchNumber: z.string().trim().max(80).optional().nullable(),
    expiryDate: z.coerce.date().optional().nullable(),
  })).min(1),
});

export const createProductionOrderSchema = z.object({
  businessId: z.string().uuid(),
  orderNumber: z.string().trim().min(1).max(50),
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  bomId: z.string().uuid(),
  plannedQuantity: z.coerce.number().positive(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const completeProductionOrderSchema = z.object({
  producedQuantity: z.coerce.number().positive(),
});

export const transferStockSchema = z.object({
  businessId: z.string().uuid(),
  productId: z.string().uuid(),
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().min(0).default(0),
  reference: z.string().trim().max(80).optional().nullable(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
export type CreateProductionOrderInput = z.infer<typeof createProductionOrderSchema>;
export type CompleteProductionOrderInput = z.infer<typeof completeProductionOrderSchema>;
export type TransferStockInput = z.infer<typeof transferStockSchema>;
