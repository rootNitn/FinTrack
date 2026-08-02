import { z } from "zod";
import { FdBankType } from "@prisma/client";

export const fdBankTypeEnum = z.nativeEnum(FdBankType);

export const createFdBankSchema = z.object({
  name: z.string().min(1, "Bank name is required").max(150),
  logoUrl: z.string().url().optional(),
  bankType: fdBankTypeEnum,
  rating: z.coerce.number().min(0).max(5).default(4),
  minDeposit: z.coerce.number().positive().default(1000),
  maxDeposit: z.coerce.number().positive().optional(),
  depositInsuranceCover: z.coerce.number().nonnegative().default(500000),
  pros: z.array(z.string().max(200)).max(10).default([]),
  cons: z.array(z.string().max(200)).max(10).default([]),
  features: z.array(z.string().max(200)).max(10).default([]),
  prematureWithdrawalRules: z.string().max(2000).optional(),
  penaltyRules: z.string().max(2000).optional(),
  taxInfo: z.string().max(2000).optional(),
  customerSupportPhone: z.string().max(30).optional(),
  customerSupportEmail: z.string().email().optional(),
  websiteUrl: z.string().url().optional(),
  isActive: z.coerce.boolean().default(true),
});

export const updateFdBankSchema = createFdBankSchema.partial();

export const fdBankListQuerySchema = z.object({
  search: z.string().max(150).optional(),
  bankType: fdBankTypeEnum.optional(),
  activeOnly: z.coerce.boolean().optional(),
});

export type CreateFdBankInput = z.infer<typeof createFdBankSchema>;
export type UpdateFdBankInput = z.infer<typeof updateFdBankSchema>;
