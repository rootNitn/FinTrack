import { z } from "zod";
import { PaymentMode } from "@prisma/client";

export const paymentModeEnum = z.nativeEnum(PaymentMode);

export const createCustomerSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  taxNumber: z.string().trim().max(40).optional().nullable(),
  creditLimit: z.coerce.number().min(0).default(0),
  openingReceivable: z.coerce.number().min(0).default(0),
});

const invoiceLineSchema = z.object({
  productId: z.string().uuid(),
  description: z.string().trim().max(240).optional().nullable(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

export const createSalesInvoiceSchema = z.object({
  businessId: z.string().uuid(),
  customerId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).max(50),
  warehouseId: z.string().uuid(),
  issueDate: z.coerce.date().default(() => new Date()),
  dueDate: z.coerce.date(),
  discountAmount: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(500).optional().nullable(),
  lines: z.array(invoiceLineSchema).min(1).max(100),
});

export const createReceivablePaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentDate: z.coerce.date().default(() => new Date()),
  paymentMode: paymentModeEnum.default(PaymentMode.BANK_TRANSFER),
  reference: z.string().trim().max(100).optional().nullable(),
});

export const createCreditNoteSchema = z.object({
  businessId: z.string().uuid(),
  customerId: z.string().uuid(),
  invoiceId: z.string().uuid().optional().nullable(),
  creditNumber: z.string().trim().min(1).max(50),
  issueDate: z.coerce.date().default(() => new Date()),
  amount: z.coerce.number().positive(),
  reason: z.string().trim().min(1).max(500),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateSalesInvoiceInput = z.infer<typeof createSalesInvoiceSchema>;
export type CreateReceivablePaymentInput = z.infer<typeof createReceivablePaymentSchema>;
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
