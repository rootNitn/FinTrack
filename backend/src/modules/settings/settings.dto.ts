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
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
