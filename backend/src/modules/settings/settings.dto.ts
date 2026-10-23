import { z } from "zod";

export const updateSettingsSchema = z.object({
  currency: z.string().length(3).optional(),
  theme: z.enum(["light", "dark"]).optional(),
  largeExpenseThreshold: z.coerce.number().nonnegative().optional(),
  notificationPreferences: z
    .object({
      fdMaturity: z.boolean().optional(),
      sipReminder: z.boolean().optional(),
      goalAchievement: z.boolean().optional(),
      monthlySummary: z.boolean().optional(),
      largeExpenseAlert: z.boolean().optional(),
      fdRateChange: z.boolean().optional(),
      higherFdRateAvailable: z.boolean().optional(),
      fdRenewalReminder: z.boolean().optional(),
      ccPaymentDue: z.boolean().optional(),
      emiDue: z.boolean().optional(),
      budgetExceeded: z.boolean().optional(),
      insuranceRenewal: z.boolean().optional(),
      birthdayReminder: z.boolean().optional(),
      medicationReminder: z.boolean().optional(),
      appointmentReminder: z.boolean().optional(),
      healthGoalAchievement: z.boolean().optional(),
    })
    .optional(),
  /** Full replacement of the user's dashboard widget order/visibility; omit to leave unchanged. */
  dashboardLayout: z
    .array(
      z.object({
        id: z.string().min(1),
        visible: z.boolean(),
      })
    )
    .optional(),
  /** User-chosen target allocation for the Financial Health Rebalancing Score (must sum to 100). Null clears back to the 60/30/10 default. */
  targetEquityPercent: z.coerce.number().min(0).max(100).nullable().optional(),
  targetDebtPercent: z.coerce.number().min(0).max(100).nullable().optional(),
  targetGoldPercent: z.coerce.number().min(0).max(100).nullable().optional(),
  /** Retirement Readiness / FI Ratio inputs. Null expense = fall back to current monthly expenses; null rate = 4%. */
  retirementMonthlyExpense: z.coerce.number().nonnegative().nullable().optional(),
  retirementWithdrawalRatePercent: z.coerce.number().min(1).max(20).nullable().optional(),
  country: z.string().length(2).toUpperCase().optional(),
  /** Ignored server-side when the resulting country is "IN" — India's fiscal year is fixed at April by law. */
  financialYearStartMonth: z.coerce.number().int().min(1).max(12).optional(),
  aiChatEnabled: z.coerce.boolean().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/** Each restored record must be a plain object carrying its original string id (used to rebuild
 * FK references within the same backup) — rejects malformed/corrupted backup files with a clean
 * 400 instead of an opaque Prisma error mid-transaction. Unknown per-entity fields are otherwise
 * passed through as-is (exported records already match the Prisma schema shape). */
const backupRecordSchema = z
  .record(z.string(), z.unknown())
  .refine((record) => typeof record["id"] === "string" && record["id"].length > 0, {
    message: "Each backup record must include a non-empty string id",
  });

const backupArraySchema = z.array(backupRecordSchema).optional();

export const restoreBackupSchema = z.object({
  bankAccounts: backupArraySchema,
  familyMembers: backupArraySchema,
  goals: backupArraySchema,
  investments: backupArraySchema,
  expenses: backupArraySchema,
  incomes: backupArraySchema,
  budgets: backupArraySchema,
  fdPortfolios: backupArraySchema,
  creditCards: backupArraySchema,
  creditCardStatements: backupArraySchema,
  creditCardPayments: backupArraySchema,
  transactions: backupArraySchema,
  importHistory: backupArraySchema,
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type RestoreBackupInput = z.infer<typeof restoreBackupSchema>;
