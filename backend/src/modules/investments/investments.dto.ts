import { z } from "zod";
import {
  InvestmentCategory,
  InvestmentStatus,
  RecurrenceInterval,
  RiskLevel,
  FdCompoundingFrequency,
  FdDepositType,
  InvestmentFdTenureUnit,
} from "@prisma/client";

export const investmentCategoryEnum = z.nativeEnum(InvestmentCategory);
export const riskLevelEnum = z.nativeEnum(RiskLevel);
export const investmentStatusEnum = z.nativeEnum(InvestmentStatus);
export const recurrenceIntervalEnum = z.nativeEnum(RecurrenceInterval);
export const fdCompoundingEnum = z.nativeEnum(FdCompoundingFrequency);
export const fdDepositTypeEnum = z.nativeEnum(FdDepositType);
export const fdTenureUnitEnum = z.nativeEnum(InvestmentFdTenureUnit);

export const createInvestmentSchema = z
  .object({
    name: z.string().min(1, "Investment name is required").max(150),
    category: investmentCategoryEnum,
    account: z.string().max(150).optional(),
    principalAmount: z.coerce.number().positive("Principal amount must be greater than 0"),
    currentValue: z.coerce.number().nonnegative("Current value cannot be negative"),
    targetValue: z.coerce.number().positive().optional(),
    purchaseDate: z.coerce.date().refine((date) => date <= new Date(), "Investment purchase date cannot be in the future"),
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
    isRecurring: z.coerce.boolean().optional().default(false),
    recurrenceInterval: recurrenceIntervalEnum.optional(),
    recurrenceEndDate: z.coerce.date().optional(),
    fdTenureValue: z.coerce.number().positive().optional(),
    fdTenureUnit: fdTenureUnitEnum.optional(),
    fdInterestRate: z.coerce.number().positive().max(30).optional(),
    fdCompounding: fdCompoundingEnum.optional(),
    fdDepositType: fdDepositTypeEnum.optional(),
    fdMaturityAmount: z.coerce.number().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isRecurring && !data.recurrenceInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "recurrenceInterval is required when isRecurring is true",
        path: ["recurrenceInterval"],
      });
    }
    if (data.category === "FIXED_DEPOSIT") {
      if (!data.fdTenureValue) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fdTenureValue"], message: "FD tenure is required" });
      if (!data.fdTenureUnit) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fdTenureUnit"], message: "FD tenure unit is required" });
      if (!data.fdInterestRate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fdInterestRate"], message: "FD interest rate is required" });
      if (!data.fdDepositType) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fdDepositType"], message: "FD payout type is required" });
      if (!data.fdCompounding) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fdCompounding"], message: "FD compounding is required" });
    }
  });

export const updateInvestmentSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  category: investmentCategoryEnum.optional(),
  account: z.string().max(150).optional(),
  principalAmount: z.coerce.number().positive().optional(),
  currentValue: z.coerce.number().nonnegative().optional(),
  targetValue: z.coerce.number().positive().optional(),
  purchaseDate: z.coerce.date().refine((date) => date <= new Date(), "Investment purchase date cannot be in the future").optional(),
  maturityDate: z.coerce.date().optional(),
  sipAmount: z.coerce.number().nonnegative().optional(),
  riskLevel: riskLevelEnum.optional(),
  notes: z.string().max(2000).optional(),
  status: investmentStatusEnum.optional(),
  goalId: z.string().uuid().nullable().optional(),
  symbol: z.string().max(20).optional(),
  units: z.coerce.number().positive().optional(),
  currency: z.string().length(3).optional(),
  exchangeRate: z.coerce.number().positive().optional(),
  familyMemberId: z.string().uuid().nullable().optional(),
  isRecurring: z.coerce.boolean().optional(),
  recurrenceInterval: recurrenceIntervalEnum.optional(),
  recurrenceEndDate: z.coerce.date().optional(),
  fdTenureValue: z.coerce.number().positive().optional(),
  fdTenureUnit: fdTenureUnitEnum.optional(),
  fdInterestRate: z.coerce.number().positive().max(30).optional(),
  fdCompounding: fdCompoundingEnum.optional(),
  fdDepositType: fdDepositTypeEnum.optional(),
  fdMaturityAmount: z.coerce.number().nonnegative().optional(),
});

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
