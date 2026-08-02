import { z } from "zod";
import { FdCompoundingFrequency } from "@prisma/client";

export const fdCompoundingEnum = z.nativeEnum(FdCompoundingFrequency);

export const createFdRateSchema = z.object({
  bankId: z.string().uuid(),
  tenureLabel: z.string().min(1).max(60),
  tenureMinDays: z.coerce.number().int().positive(),
  tenureMaxDays: z.coerce.number().int().positive(),
  interestRate: z.coerce.number().positive().max(20),
  seniorCitizenRate: z.coerce.number().positive().max(20),
  compounding: fdCompoundingEnum.default("QUARTERLY"),
  payoutOptions: z.array(z.string()).default(["CUMULATIVE"]),
});

export const updateFdRateSchema = createFdRateSchema.partial().omit({ bankId: true });

export const comparisonQuerySchema = z.object({
  amount: z.coerce.number().positive().optional(),
  tenureDays: z.coerce.number().int().positive().optional(),
  fdType: z.enum(["REGULAR", "SENIOR"]).default("REGULAR"),
  bankTypes: z.string().optional(), // comma-separated FdBankType values
  depositType: z.enum(["CUMULATIVE", "MONTHLY_INTEREST", "QUARTERLY_INTEREST"]).default("CUMULATIVE"),
  compounding: fdCompoundingEnum.optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  search: z.string().max(150).optional(),
  sortBy: z.enum(["interestRate", "maturityAmount", "bankName", "rating", "tenure"]).default("maturityAmount"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateFdRateInput = z.infer<typeof createFdRateSchema>;
export type UpdateFdRateInput = z.infer<typeof updateFdRateSchema>;
export type ComparisonQuery = z.infer<typeof comparisonQuerySchema>;
