import { z } from "zod";

export const reconciliationQuerySchema = z.object({
  financialYearCode: z.string().min(1),
});
