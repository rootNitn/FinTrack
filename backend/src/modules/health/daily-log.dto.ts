import { z } from "zod";

export const upsertDailyLogSchema = z.object({
  waterIntakeMl: z.coerce.number().int().nonnegative().optional(),
  sleepHours: z.coerce.number().min(0).max(24).optional(),
  steps: z.coerce.number().int().nonnegative().optional(),
});

export const dailyLogDateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format"),
});

export type UpsertDailyLogInput = z.infer<typeof upsertDailyLogSchema>;
