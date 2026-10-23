import { z } from "zod";
import { expenseCategoryEnum, paymentModeEnum } from "../expenses/expenses.dto";
import { incomeSourceEnum } from "../income/income.dto";

export const bankImportMappingSchema = z
  .object({
    date: z.string().min(1, "Date column is required"),
    description: z.string().min(1, "Description column is required"),
    // Either a single signed "amount" column, or separate debit/credit columns — at least one is required.
    amount: z.string().nullable().optional(),
    debit: z.string().nullable().optional(),
    credit: z.string().nullable().optional(),
    bankAccountId: z.string().uuid().nullable().optional(),
    toleranceDays: z.coerce.number().int().min(0).max(30).default(3),
    toleranceAmount: z.coerce.number().nonnegative().max(1000).default(1),
  })
  .superRefine((data, ctx) => {
    if (!data.amount && !data.debit && !data.credit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Map either an Amount column or Debit/Credit columns",
        path: ["amount"],
      });
    }
  });

export type BankImportMapping = z.infer<typeof bankImportMappingSchema>;

const bankImportCommitEntrySchema = z
  .object({
    rowNumber: z.number().int(),
    date: z.coerce.date(),
    description: z.string().max(500).optional(),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    type: z.enum(["EXPENSE", "INCOME"]),
    category: expenseCategoryEnum.optional(),
    paymentMode: paymentModeEnum.optional(),
    source: incomeSourceEnum.optional(),
    bankAccountId: z.string().uuid().optional(),
    familyMemberId: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "EXPENSE" && !data.category) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "category is required for EXPENSE entries", path: ["category"] });
    }
    if (data.type === "INCOME" && !data.source) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "source is required for INCOME entries", path: ["source"] });
    }
  });

export const bankImportCommitSchema = z.object({
  entries: z.array(bankImportCommitEntrySchema).min(1, "At least one row is required").max(200),
});

export type BankImportCommitEntry = z.infer<typeof bankImportCommitEntrySchema>;
export type BankImportCommitInput = z.infer<typeof bankImportCommitSchema>;

