import { z } from "zod";

const salesLineSchema = z.object({
  productId: z.string().uuid(),
  description: z.string().trim().max(240).optional().nullable(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

export const createQuotationSchema = z.object({
  businessId: z.string().uuid(),
  customerId: z.string().uuid(),
  quotationNumber: z.string().trim().min(1).max(50),
  issueDate: z.coerce.date().default(() => new Date()),
  validUntil: z.coerce.date(),
  notes: z.string().trim().max(500).optional().nullable(),
  lines: z.array(salesLineSchema).min(1).max(100),
});

export const createSalesOrderSchema = z.object({
  businessId: z.string().uuid(),
  customerId: z.string().uuid(),
  quotationId: z.string().uuid().optional().nullable(),
  orderNumber: z.string().trim().min(1).max(50),
  orderDate: z.coerce.date().default(() => new Date()),
  notes: z.string().trim().max(500).optional().nullable(),
  lines: z.array(salesLineSchema).min(1).max(100),
});

export const createSalesReturnSchema = z.object({
  businessId: z.string().uuid(),
  customerId: z.string().uuid(),
  invoiceId: z.string().uuid().optional().nullable(),
  warehouseId: z.string().uuid(),
  returnNumber: z.string().trim().min(1).max(50),
  returnDate: z.coerce.date().default(() => new Date()),
  reason: z.string().trim().min(1).max(500),
  lines: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().positive(),
    unitCost: z.coerce.number().min(0),
    unitPrice: z.coerce.number().min(0),
  })).min(1).max(100),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export type CreateSalesReturnInput = z.infer<typeof createSalesReturnSchema>;
