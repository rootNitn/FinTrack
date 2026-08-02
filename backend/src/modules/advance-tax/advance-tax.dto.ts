import { z } from "zod";

export const advanceTaxInstallmentInputSchema = z.object({
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  paidAmount: z.coerce.number().min(0),
  paidDate: z.coerce.date().optional(),
});

export const calculateAdvanceTaxSchema = z.object({
  financialYearCode: z.string().min(1),
  estimatedTaxLiability: z.coerce.number().min(0),
  tdsAlreadyDeducted: z.coerce.number().min(0).optional().default(0),
  installments: z.array(advanceTaxInstallmentInputSchema).max(4).optional().default([]),
  asOfDate: z.coerce.date().optional(),
});

export const listAdvanceTaxQuerySchema = z.object({
  financialYearCode: z.string().min(1).optional(),
});

export type CalculateAdvanceTaxInput = z.infer<typeof calculateAdvanceTaxSchema>;
