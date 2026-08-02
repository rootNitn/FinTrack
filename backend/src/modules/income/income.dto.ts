import { z } from "zod";
import { IncomeSource } from "@prisma/client";

export const incomeSourceEnum = z.nativeEnum(IncomeSource);

export const createIncomeSchema = z.object({
  date: z.coerce.date(),
  source: incomeSourceEnum,
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().max(500).optional(),
  bankAccountId: z.string().uuid().optional(),
});

export const updateIncomeSchema = createIncomeSchema.partial();

export const incomeListQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  source: incomeSourceEnum.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
export type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;
