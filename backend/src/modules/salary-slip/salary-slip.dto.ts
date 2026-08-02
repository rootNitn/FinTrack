import { z } from "zod";

export const importSalarySlipSchema = z.object({
  financialYearCode: z.string().min(1),
});

const optionalNum = () => z.coerce.number().min(0).optional();

export const updateSalarySlipSchema = z.object({
  month: z.string().optional(),
  employeeName: z.string().optional(),
  employerName: z.string().optional(),
  pan: z.string().optional(),
  basicSalary: optionalNum(),
  hra: optionalNum(),
  specialAllowance: optionalNum(),
  conveyance: optionalNum(),
  medicalAllowance: optionalNum(),
  lta: optionalNum(),
  bonus: optionalNum(),
  commission: optionalNum(),
  employerPf: optionalNum(),
  employeePf: optionalNum(),
  professionalTax: optionalNum(),
  incomeTaxTds: optionalNum(),
  grossSalary: optionalNum(),
  netSalary: optionalNum(),
  otherAllowances: optionalNum(),
});

export const listSalarySlipQuerySchema = z.object({
  financialYearCode: z.string().min(1).optional(),
});

export type UpdateSalarySlipInput = z.infer<typeof updateSalarySlipSchema>;
