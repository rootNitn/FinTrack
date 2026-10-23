import { z } from "zod";
import { IncomeSource, RecurrenceInterval } from "@prisma/client";

export const incomeSourceEnum = z.nativeEnum(IncomeSource);
export const recurrenceIntervalEnum = z.nativeEnum(RecurrenceInterval);

export const createIncomeSchema = z
  .object({
    date: z.coerce.date().refine((date) => date <= new Date(), "Income date cannot be in the future"),
    source: incomeSourceEnum,
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    description: z.string().max(500).optional(),
    bankAccountId: z.string().uuid().optional(),
    familyMemberId: z.string().uuid().nullable().optional(),
    isRecurring: z.coerce.boolean().optional().default(false),
    recurrenceInterval: recurrenceIntervalEnum.optional(),
    recurrenceEndDate: z.coerce.date().optional(),
    // When a same-day/amount/source income entry already exists, create() rejects with 409 unless
    // this is set — the frontend re-submits with force:true after the user confirms "add anyway".
    force: z.coerce.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.isRecurring && !data.recurrenceInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "recurrenceInterval is required when isRecurring is true",
        path: ["recurrenceInterval"],
      });
    }
  });

export const updateIncomeSchema = z.object({
  date: z.coerce.date().refine((date) => date <= new Date(), "Income date cannot be in the future").optional(),
  source: incomeSourceEnum.optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0").optional(),
  description: z.string().max(500).optional(),
  bankAccountId: z.string().uuid().optional(),
  familyMemberId: z.string().uuid().nullable().optional(),
  isRecurring: z.coerce.boolean().optional(),
  recurrenceInterval: recurrenceIntervalEnum.optional(),
  recurrenceEndDate: z.coerce.date().optional(),
});

export const incomeListQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  source: incomeSourceEnum.optional(),
  bankAccountId: z.string().uuid().optional(),
  familyMemberId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
export type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;
