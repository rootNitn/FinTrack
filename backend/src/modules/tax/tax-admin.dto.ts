import { z } from "zod";

export const regimeEnum = z.enum(["OLD", "NEW"]);
export const ageCategoryEnum = z.enum(["GENERAL", "SENIOR", "SUPER_SENIOR"]);

export const createFinancialYearSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  assessmentYear: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isDefault: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
});
export const updateFinancialYearSchema = createFinancialYearSchema.partial();

export const createSlabSchema = z.object({
  financialYearId: z.string().uuid(),
  regime: regimeEnum,
  ageCategory: ageCategoryEnum.default("GENERAL"),
  slabOrder: z.coerce.number().int().min(1),
  minIncome: z.coerce.number().min(0),
  maxIncome: z.coerce.number().min(0).nullable().optional(),
  ratePercent: z.coerce.number().min(0).max(100),
});
export const updateSlabSchema = createSlabSchema.partial().omit({ financialYearId: true });

export const createRebateRuleSchema = z.object({
  financialYearId: z.string().uuid(),
  regime: regimeEnum,
  thresholdIncome: z.coerce.number().min(0),
  maxRebateAmount: z.coerce.number().min(0),
  marginalReliefEnabled: z.coerce.boolean().default(true),
});
export const updateRebateRuleSchema = createRebateRuleSchema.partial().omit({ financialYearId: true });

export const createSurchargeRuleSchema = z.object({
  financialYearId: z.string().uuid(),
  regime: regimeEnum,
  slabOrder: z.coerce.number().int().min(1),
  minIncome: z.coerce.number().min(0),
  maxIncome: z.coerce.number().min(0).nullable().optional(),
  ratePercent: z.coerce.number().min(0).max(100),
  marginalReliefEnabled: z.coerce.boolean().default(true),
});
export const updateSurchargeRuleSchema = createSurchargeRuleSchema.partial().omit({ financialYearId: true });

export const createCessRuleSchema = z.object({
  financialYearId: z.string().uuid(),
  label: z.string().min(1).default("Health & Education Cess"),
  ratePercent: z.coerce.number().min(0).max(100),
});
export const updateCessRuleSchema = createCessRuleSchema.partial().omit({ financialYearId: true });

export const createDeductionRuleSchema = z.object({
  financialYearId: z.string().uuid(),
  regime: regimeEnum,
  code: z.string().min(1),
  label: z.string().min(1),
  maxLimit: z.coerce.number().min(0).nullable().optional(),
  ratePercent: z.coerce.number().min(0).max(100).nullable().optional(),
  isAllowed: z.coerce.boolean().default(true),
});
export const updateDeductionRuleSchema = createDeductionRuleSchema.partial().omit({ financialYearId: true });

export const capitalGainAssetTypeEnum = z.enum(["STOCK", "MUTUAL_FUND", "PROPERTY", "GOLD", "CRYPTO"]);
export const capitalGainTermTypeEnum = z.enum(["SHORT", "LONG"]);
export const taxDocumentTypeEnum = z.enum(["SALARY_SLIP", "FORM16", "AIS", "FORM26AS", "CAPITAL_GAINS_STATEMENT", "OTHER"]);

export const createCapitalGainRuleSchema = z.object({
  assetType: capitalGainAssetTypeEnum,
  termType: capitalGainTermTypeEnum,
  ratePercent: z.coerce.number().min(0).max(100),
  exemptionLimit: z.coerce.number().min(0).nullable().optional(),
  indexationAllowed: z.coerce.boolean().default(false),
});
export const updateCapitalGainRuleSchema = createCapitalGainRuleSchema.partial();

export const createCostInflationIndexSchema = z.object({
  year: z.string().min(1),
  ciiValue: z.coerce.number().int().min(1),
});
export const updateCostInflationIndexSchema = createCostInflationIndexSchema.partial();

export const createValidationRuleSchema = z.object({
  documentType: taxDocumentTypeEnum,
  fieldName: z.string().min(1),
  condition: z.string().min(1),
  tolerance: z.coerce.number().min(0).default(1),
  message: z.string().min(1),
  isActive: z.coerce.boolean().default(true),
});
export const updateValidationRuleSchema = createValidationRuleSchema.partial();

export type CreateFinancialYearInput = z.infer<typeof createFinancialYearSchema>;
export type UpdateFinancialYearInput = z.infer<typeof updateFinancialYearSchema>;
export type CreateSlabInput = z.infer<typeof createSlabSchema>;
export type UpdateSlabInput = z.infer<typeof updateSlabSchema>;
export type CreateRebateRuleInput = z.infer<typeof createRebateRuleSchema>;
export type UpdateRebateRuleInput = z.infer<typeof updateRebateRuleSchema>;
export type CreateSurchargeRuleInput = z.infer<typeof createSurchargeRuleSchema>;
export type UpdateSurchargeRuleInput = z.infer<typeof updateSurchargeRuleSchema>;
export type CreateCessRuleInput = z.infer<typeof createCessRuleSchema>;
export type UpdateCessRuleInput = z.infer<typeof updateCessRuleSchema>;
export type CreateDeductionRuleInput = z.infer<typeof createDeductionRuleSchema>;
export type UpdateDeductionRuleInput = z.infer<typeof updateDeductionRuleSchema>;
export type CreateCapitalGainRuleInput = z.infer<typeof createCapitalGainRuleSchema>;
export type UpdateCapitalGainRuleInput = z.infer<typeof updateCapitalGainRuleSchema>;
export type CreateCostInflationIndexInput = z.infer<typeof createCostInflationIndexSchema>;
export type UpdateCostInflationIndexInput = z.infer<typeof updateCostInflationIndexSchema>;
export type CreateValidationRuleInput = z.infer<typeof createValidationRuleSchema>;
export type UpdateValidationRuleInput = z.infer<typeof updateValidationRuleSchema>;
