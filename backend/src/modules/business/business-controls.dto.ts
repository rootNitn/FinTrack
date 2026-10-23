import { z } from "zod";

export const createPeriodSchema = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/), startDate: z.coerce.date(), endDate: z.coerce.date() });
export const periodActionSchema = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/) });
export type CreatePeriodInput = z.infer<typeof createPeriodSchema>;
