import { z } from "zod";

export const calculateGratuitySchema = z.object({
  employeeType: z.enum(["GOVERNMENT", "NON_GOVERNMENT"]),
  gratuityReceived: z.coerce.number().min(0),
  lastDrawnSalary: z.coerce.number().min(0),
  yearsOfService: z.coerce.number().min(0),
  isCoveredUnderGratuityAct: z.coerce.boolean().optional().default(true),
  financialYearCode: z.string().min(1).optional(),
});

export type CalculateGratuityInput = z.infer<typeof calculateGratuitySchema>;
