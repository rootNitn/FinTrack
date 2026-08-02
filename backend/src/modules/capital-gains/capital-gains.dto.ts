import { z } from "zod";

export const capitalGainAssetTypeSchema = z.enum(["STOCK", "MUTUAL_FUND", "PROPERTY", "GOLD", "CRYPTO"]);

export const capitalGainsTransactionInputSchema = z.object({
  assetType: capitalGainAssetTypeSchema,
  purchaseDate: z.coerce.date(),
  purchasePrice: z.coerce.number().min(0),
  saleDate: z.coerce.date(),
  salePrice: z.coerce.number().min(0),
  quantity: z.coerce.number().min(0),
  brokerage: z.coerce.number().min(0).optional().default(0),
  stampDuty: z.coerce.number().min(0).optional().default(0),
  transferCharges: z.coerce.number().min(0).optional().default(0),
});

export const calculateCapitalGainsSchema = z.object({
  financialYearCode: z.string().min(1),
  transactions: z.array(capitalGainsTransactionInputSchema).min(1),
});

export const listCapitalGainsQuerySchema = z.object({
  financialYearCode: z.string().min(1).optional(),
});

export type CapitalGainsTransactionInput = z.infer<typeof capitalGainsTransactionInputSchema>;
export type CalculateCapitalGainsInput = z.infer<typeof calculateCapitalGainsSchema>;
