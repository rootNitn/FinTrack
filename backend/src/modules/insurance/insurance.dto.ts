import { z } from "zod";
import { InsuranceType } from "@prisma/client";

export const insuranceTypeEnum = z.nativeEnum(InsuranceType);

export const createInsurancePolicySchema = z.object({
  type: insuranceTypeEnum,
  provider: z.string().max(150).nullable().optional(),
  sumInsured: z.coerce.number().nonnegative("Sum insured must be 0 or greater"),
  premiumAmount: z.coerce.number().nonnegative().nullable().optional(),
  coversFamily: z.coerce.boolean().optional().default(false),
  expiryDate: z.coerce.date().nullable().optional(),
  renewalDate: z.coerce.date().nullable().optional(),
  nominee: z.string().max(150).nullable().optional(),
  familyMemberId: z.string().uuid().nullable().optional(),
});

export const updateInsurancePolicySchema = createInsurancePolicySchema.partial();

export type CreateInsurancePolicyInput = z.infer<typeof createInsurancePolicySchema>;
export type UpdateInsurancePolicyInput = z.infer<typeof updateInsurancePolicySchema>;
