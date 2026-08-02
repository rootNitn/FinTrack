import { z } from "zod";

export const importForm26ASSchema = z.object({
  financialYearCode: z.string().min(1),
});

const optionalNum = () => z.coerce.number().min(0).optional();

export const updateForm26ASSchema = z.object({
  employerTds: optionalNum(),
  bankTds: optionalNum(),
  dividendTds: optionalNum(),
  propertyTds: optionalNum(),
  professionalIncomeTds: optionalNum(),
  advanceTax: optionalNum(),
  selfAssessmentTax: optionalNum(),
  refund: optionalNum(),
  totalTaxPaid: optionalNum(),
});

export const listForm26ASQuerySchema = z.object({
  financialYearCode: z.string().min(1).optional(),
});

export type UpdateForm26ASInput = z.infer<typeof updateForm26ASSchema>;
