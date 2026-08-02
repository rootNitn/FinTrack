import { z } from "zod";

export const compareInvestmentsQuerySchema = z.object({
  amount: z.coerce.number().positive().min(500).max(1_000_000_000),
  tenureYears: z.coerce.number().positive().min(0.08).max(40),
  riskLevels: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(",").filter(Boolean) : undefined)),
  sortBy: z.enum(["maturityAmount", "assumedAnnualReturnPercent", "effectiveAnnualYieldPercent"]).optional().default("maturityAmount"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type CompareInvestmentsQuery = z.infer<typeof compareInvestmentsQuerySchema>;
