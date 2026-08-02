import { z } from "zod";
import {
  InvestmentCategory,
  InvestmentStatus,
  RiskLevel,
} from "@prisma/client";

export const investmentCategoryEnum = z.nativeEnum(InvestmentCategory);
export const riskLevelEnum = z.nativeEnum(RiskLevel);
export const investmentStatusEnum = z.nativeEnum(InvestmentStatus);

export const createInvestmentSchema = z.object({
  name: z.string().min(1, "Investment name is required").max(150),
  category: investmentCategoryEnum,
  account: z.string().max(150).optional(),
  principalAmount: z.coerce.number().positive("Principal amount must be greater than 0"),
  currentValue: z.coerce.number().nonnegative("Current value cannot be negative"),
  targetValue: z.coerce.number().positive().optional(),
  purchaseDate: z.coerce.date(),
  maturityDate: z.coerce.date().optional(),
  sipAmount: z.coerce.number().nonnegative().optional(),
  riskLevel: riskLevelEnum.default("MODERATE"),
  notes: z.string().max(2000).optional(),
  status: investmentStatusEnum.default("ACTIVE"),
  goalId: z.string().uuid().nullable().optional(),
  symbol: z.string().max(20).optional(),
  units: z.coerce.number().positive().optional(),
  currency: z.string().length(3).optional(),
  exchangeRate: z.coerce.number().positive().optional(),
  familyMemberId: z.string().uuid().nullable().optional(),
});

export const updateInvestmentSchema = createInvestmentSchema.partial();

export const investmentListQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  category: investmentCategoryEnum.optional(),
  status: investmentStatusEnum.optional(),
  riskLevel: riskLevelEnum.optional(),
  familyMemberId: z.string().optional(),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Provide at least one investment id"),
});

export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;
export type UpdateInvestmentInput = z.infer<typeof updateInvestmentSchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
