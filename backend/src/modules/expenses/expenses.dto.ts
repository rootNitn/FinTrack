import { z } from "zod";
import { ExpenseCategory, PaymentMode, RecurrenceInterval } from "@prisma/client";

export const expenseCategoryEnum = z.nativeEnum(ExpenseCategory);
export const paymentModeEnum = z.nativeEnum(PaymentMode);
export const recurrenceIntervalEnum = z.nativeEnum(RecurrenceInterval);

export const expenseSplitSchema = z.object({
  participantName: z.string().min(1).max(120),
  amount: z.coerce.number().positive("Split amount must be greater than 0"),
});

export const createExpenseSchema = z
  .object({
    date: z.coerce.date(),
    category: expenseCategoryEnum,
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    paymentMode: paymentModeEnum,
    description: z.string().max(500).optional(),
    bankAccountId: z.string().uuid().optional(),
    isRecurring: z.coerce.boolean().optional().default(false),
    recurrenceInterval: recurrenceIntervalEnum.optional(),
    recurrenceEndDate: z.coerce.date().optional(),
    splits: z.array(expenseSplitSchema).max(20).optional(),
    familyMemberId: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isRecurring && !data.recurrenceInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "recurrenceInterval is required when isRecurring is true",
        path: ["recurrenceInterval"],
      });
    }
    if (data.splits?.length && data.splits.reduce((sum, s) => sum + s.amount, 0) > data.amount + 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sum of split amounts cannot exceed the expense amount",
        path: ["splits"],
      });
    }
  });

export const updateExpenseSchema = z.object({
  date: z.coerce.date().optional(),
  category: expenseCategoryEnum.optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0").optional(),
  paymentMode: paymentModeEnum.optional(),
  description: z.string().max(500).optional(),
  bankAccountId: z.string().uuid().optional(),
  isRecurring: z.coerce.boolean().optional(),
  recurrenceInterval: recurrenceIntervalEnum.optional(),
  recurrenceEndDate: z.coerce.date().optional(),
  splits: z.array(expenseSplitSchema).max(20).optional(),
  familyMemberId: z.string().uuid().nullable().optional(),
});

export const expenseListQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  category: expenseCategoryEnum.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  familyMemberId: z.string().optional(),
});

export const spendingTrendsQuerySchema = z.object({
  months: z.coerce.number().min(1).max(24).optional(),
});

export const updateExpenseSplitSchema = z.object({
  isSettled: z.boolean(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
