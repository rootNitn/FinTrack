import { z } from "zod";

export const importAisSchema = z.object({
  financialYearCode: z.string().min(1),
});

const optionalNum = () => z.coerce.number().min(0).optional();

export const updateAisSchema = z.object({
  salaryIncome: optionalNum(),
  interestIncome: optionalNum(),
  dividendIncome: optionalNum(),
  capitalGainsIncome: optionalNum(),
  propertyIncome: optionalNum(),
  businessIncome: optionalNum(),
  otherIncome: optionalNum(),
  taxPaid: optionalNum(),
  tdsAmount: optionalNum(),
  tcsAmount: optionalNum(),
  advanceTax: optionalNum(),
});

export const listAisQuerySchema = z.object({
  financialYearCode: z.string().min(1).optional(),
});

export type UpdateAisInput = z.infer<typeof updateAisSchema>;
