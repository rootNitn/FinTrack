import { z } from "zod";

export const paidBillSchema = z.object({
  paidDate: z.coerce.date().optional(),
});

export const snoozeBillSchema = z.object({
  snoozedUntil: z.coerce.date().refine((date) => date > new Date(), "Snooze date must be in the future"),
});
