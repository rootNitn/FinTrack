import { z } from "zod";
import { calculateTaxSchema } from "../tax/tax.dto";

export const generateTaxPlanSchema = z.object({
  financialYearCode: z.string().min(1),
  taxInput: calculateTaxSchema.optional(),
});

export type GenerateTaxPlanInput = z.infer<typeof generateTaxPlanSchema>;
