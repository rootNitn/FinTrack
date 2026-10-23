import { z } from "zod";
import { BusinessProductType, BusinessStockMovementType } from "@prisma/client";

export const productTypeEnum = z.nativeEnum(BusinessProductType);
export const stockMovementTypeEnum = z.nativeEnum(BusinessStockMovementType);

export const createProductSchema = z.object({
  businessId: z.string().uuid(),
  sku: z.string().trim().min(1).max(40),
  barcode: z.string().trim().max(80).optional().nullable(),
  retailCategory: z.string().trim().max(80).optional().nullable(),
  brand: z.string().trim().max(80).optional().nullable(),
  name: z.string().trim().min(1).max(160),
  type: productTypeEnum,
  unit: z.string().trim().min(1).max(20).default("PCS"),
  reorderLevel: z.coerce.number().min(0).default(0),
  standardCost: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
});

export const updateProductSchema = createProductSchema.omit({ businessId: true }).partial().extend({
  sku: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  barcode: z.string().trim().max(80).optional().nullable(),
  retailCategory: z.string().trim().max(80).optional().nullable(),
  brand: z.string().trim().max(80).optional().nullable(),
});

export const createSupplierSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  contactName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  taxNumber: z.string().trim().max(40).optional().nullable(),
  openingDue: z.coerce.number().min(0).default(0),
});

export const createWarehouseSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  location: z.string().trim().max(160).optional().nullable(),
});

export const createStockMovementSchema = z.object({
  businessId: z.string().uuid(),
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  supplierId: z.string().uuid().optional().nullable(),
  type: stockMovementTypeEnum,
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().min(0).default(0),
  batchNumber: z.string().trim().max(80).optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  reference: z.string().trim().max(80).optional().nullable(),
  movementDate: z.coerce.date().default(() => new Date()),
});

const bomLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(20).default("PCS"),
});

export const createBomSchema = z.object({
  businessId: z.string().uuid(),
  productId: z.string().uuid(),
  version: z.coerce.number().int().positive().default(1),
  scrapPercent: z.coerce.number().min(0).max(100).default(0),
  lines: z.array(bomLineSchema).min(1).max(100),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type CreateBomInput = z.infer<typeof createBomSchema>;
