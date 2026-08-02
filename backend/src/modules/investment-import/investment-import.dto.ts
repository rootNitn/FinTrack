import { z } from "zod";
import { InvestmentCategory } from "@prisma/client";

export const importRowSchema = z.object({
  rowNumber: z.number().int().nonnegative(),
  name: z.string(),
  transactionType: z.string(),
  purchaseDate: z.string(),
  units: z.number().nullable(),
  purchaseNav: z.number().nullable(),
  amount: z.number().nullable(),
  symbol: z.string().nullable().optional(),
});

export const commitImportSchema = z.object({
  fileName: z.string().min(1),
  provider: z.string().min(1),
  rows: z.array(importRowSchema).min(1, "Select at least one row to import"),
  /** Required when provider is the generic CSV import (no fixed category); ignored for known broker importers. */
  category: z.nativeEnum(InvestmentCategory).optional(),
});

export const exportFailedRowsSchema = z.object({
  rows: z.array(
    importRowSchema.extend({
      reason: z.string().optional(),
    })
  ),
});

/** Maps logical investment fields onto source-file column headers, for the generic CSV import flow. */
export const genericCsvMappingSchema = z.object({
  name: z.string().min(1),
  transactionType: z.string().nullable().optional(),
  purchaseDate: z.string().min(1),
  units: z.string().nullable().optional(),
  purchaseNav: z.string().nullable().optional(),
  amount: z.string().min(1),
  symbol: z.string().nullable().optional(),
});

export type ImportRowInput = z.infer<typeof importRowSchema>;
export type CommitImportInput = z.infer<typeof commitImportSchema>;
export type ExportFailedRowsInput = z.infer<typeof exportFailedRowsSchema>;
export type GenericCsvMappingInput = z.infer<typeof genericCsvMappingSchema>;
