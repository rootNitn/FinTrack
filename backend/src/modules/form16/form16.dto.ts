import { z } from "zod";

export const importForm16Schema = z.object({
  financialYearCode: z.string().min(1),
});

const optionalNum = () => z.coerce.number().min(0).optional();

export const updateForm16Schema = z.object({
  assessmentYear: z.string().optional(),
  employerName: z.string().optional(),
  employeeName: z.string().optional(),
  pan: z.string().optional(),
  tan: z.string().optional(),
  grossSalary: optionalNum(),
  exemptions: optionalNum(),
  deductions: optionalNum(),
  professionalTax: optionalNum(),
  standardDeduction: optionalNum(),
  employerNpsContribution: optionalNum(),
  taxableIncome: optionalNum(),
  tdsDeducted: optionalNum(),
  taxDeposited: optionalNum(),
});

export const listForm16QuerySchema = z.object({
  financialYearCode: z.string().min(1).optional(),
});

export type UpdateForm16Input = z.infer<typeof updateForm16Schema>;
