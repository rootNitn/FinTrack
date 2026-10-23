import { z } from "zod";
import { IncomeSourceGrowthPotential, IncomeSourceMode, IncomeSourceStability } from "@prisma/client";

const sourceFields = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(60),
  incomeMode: z.nativeEnum(IncomeSourceMode).default("ACTIVE"),
  monthlyAverageAmount: z.coerce.number().nonnegative(),
  annualAmount: z.coerce.number().nonnegative().nullable().optional(),
  frequency: z.string().trim().min(1).max(30).default("MONTHLY"),
  stability: z.nativeEnum(IncomeSourceStability).default("MEDIUM"),
  growthPotential: z.nativeEnum(IncomeSourceGrowthPotential).default("MEDIUM"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  isActive: z.coerce.boolean().default(true),
  notes: z.string().max(1000).nullable().optional(),
});

function validateDateRange<T extends { startDate?: Date; endDate?: Date | null }>(data: T, ctx: z.RefinementCtx) {
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be on or after the start date" });
  }
}

export const createIncomeSourceSchema = sourceFields.superRefine(validateDateRange);
export const updateIncomeSourceSchema = sourceFields.partial().superRefine((data, ctx) => {
  if (data.startDate && data.endDate && data.endDate < data.startDate) validateDateRange(data, ctx);
});
export type CreateIncomeSourceInput = z.infer<typeof createIncomeSourceSchema>;
export type UpdateIncomeSourceInput = z.infer<typeof updateIncomeSourceSchema>;
