import { z } from "zod";

export const reportTypeEnum = z.enum(["monthly", "quarterly", "yearly", "investment", "expense", "goal"]);

export const reportQuerySchema = z.object({
  type: reportTypeEnum,
  month: z.coerce.number().min(1).max(12).optional(),
  quarter: z.coerce.number().min(1).max(4).optional(),
  year: z.coerce.number().min(2000).max(2100).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
