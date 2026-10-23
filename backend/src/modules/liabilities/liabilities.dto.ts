import { z } from "zod";
import { LiabilityType } from "@prisma/client";

export const liabilityTypeEnum = z.nativeEnum(LiabilityType);

export const createLiabilitySchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  type: liabilityTypeEnum.default("OTHER"),
  amount: z.coerce.number().nonnegative("Amount must be 0 or greater"),
  interestRatePercent: z.coerce.number().nonnegative().max(100).nullable().optional(),
  principalAmount: z.coerce.number().positive().nullable().optional(),
  tenureMonths: z.coerce.number().int().positive().max(600).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  emiAmount: z.coerce.number().positive().nullable().optional(),
  familyMemberId: z.string().uuid().nullable().optional(),
});

export const updateLiabilitySchema = createLiabilitySchema.partial();

export const prepaymentImpactSchema = z.object({
  extraMonthlyPayment: z.coerce.number().nonnegative().default(0),
  lumpSum: z.coerce.number().nonnegative().default(0),
});

export const debtPayoffStrategySchema = z.object({
  extraMonthlyBudget: z.coerce.number().nonnegative().default(0),
});

export type CreateLiabilityInput = z.infer<typeof createLiabilitySchema>;
export type UpdateLiabilityInput = z.infer<typeof updateLiabilitySchema>;
export type PrepaymentImpactInput = z.infer<typeof prepaymentImpactSchema>;
export type DebtPayoffStrategyInput = z.infer<typeof debtPayoffStrategySchema>;
