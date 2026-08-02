import { z } from "zod";

export const rateHistoryRangeEnum = z.enum(["1M", "3M", "6M", "1Y", "ALL"]);

export const rateHistoryQuerySchema = z.object({
  tenureLabel: z.string().default("1 Year"),
  range: rateHistoryRangeEnum.default("1Y"),
});

export const recordRateHistorySchema = z.object({
  bankId: z.string().uuid(),
  tenureLabel: z.string().min(1).max(60),
  interestRate: z.coerce.number().positive().max(20),
});

export type RateHistoryQuery = z.infer<typeof rateHistoryQuerySchema>;
