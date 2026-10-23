import { z } from "zod";

export const businessReportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { message: "from must be before to" });

export type BusinessReportQuery = z.infer<typeof businessReportQuerySchema>;
