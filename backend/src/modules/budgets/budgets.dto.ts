import { z } from "zod";
import { ExpenseCategory } from "@prisma/client";

export const expenseCategoryEnum = z.nativeEnum(ExpenseCategory);

export const upsertBudgetSchema = z.object({
  category: expenseCategoryEnum.nullable().optional(),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
  amount: z.coerce.number().positive("Budget amount must be greater than 0"),
  familyMemberId: z.string().uuid().nullable().optional(),
});

export const budgetQuerySchema = z.object({
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2000).max(2100).optional(),
  familyMemberId: z.string().optional(),
});

export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;
