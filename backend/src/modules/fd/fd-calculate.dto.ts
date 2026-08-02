import { z } from "zod";
import { FdCompoundingFrequency, FdDepositType } from "@prisma/client";

export const calculateFdSchema = z.object({
  principal: z.coerce.number().positive("Deposit amount must be positive"),
  fdType: z.enum(["REGULAR", "SENIOR"]).default("REGULAR"),
  bankId: z.string().uuid().optional(),
  interestRate: z.coerce.number().positive().max(20).optional(),
  depositType: z.nativeEnum(FdDepositType).default("CUMULATIVE"),
  tenureValue: z.coerce.number().positive(),
  tenureUnit: z.enum(["DAYS", "MONTHS", "YEARS"]).default("YEARS"),
  compounding: z.nativeEnum(FdCompoundingFrequency).default("QUARTERLY"),
});

export const ladderPlanSchema = z.object({
  totalAmount: z.coerce.number().positive("Total amount must be positive"),
  fdType: z.enum(["REGULAR", "SENIOR"]).default("REGULAR"),
  rungs: z
    .array(z.coerce.number().int().positive())
    .default([1, 2, 3, 5])
    .describe("Tenure in years for each ladder rung"),
});

export type CalculateFdInput = z.infer<typeof calculateFdSchema>;
export type LadderPlanInput = z.infer<typeof ladderPlanSchema>;
