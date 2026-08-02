import { z } from "zod";

const num = () => z.coerce.number().min(0).default(0);

export const personalDetailsSchema = z.object({
  age: z.coerce.number().int().min(0).max(120),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  residentialStatus: z.enum(["RESIDENT", "NON_RESIDENT", "RNOR"]).default("RESIDENT"),
  employmentType: z.enum(["SALARIED", "SELF_EMPLOYED", "BUSINESS", "PENSIONER"]),
  state: z.string().min(1),
});

export const salaryDetailsSchema = z.object({
  basicSalary: num(),
  hraReceived: num(),
  rentPaid: num(),
  specialAllowance: num(),
  bonus: num(),
  commission: num(),
  employerPf: num(),
  employeePf: num(),
  gratuity: num(),
  leaveEncashment: num(),
  otherAllowances: num(),
  perquisites: num(),
  professionalTax: num(),
});

export const housePropertySchema = z.object({
  type: z.enum(["SELF_OCCUPIED", "LET_OUT", "NONE"]).default("NONE"),
  rentalIncome: num(),
  municipalTaxes: num(),
  homeLoanInterest: num(),
});

export const otherIncomeSchema = z.object({
  savingsInterest: num(),
  fdInterest: num(),
  rdInterest: num(),
  dividendIncome: num(),
  familyPension: num(),
  agricultureIncome: num(),
  otherSourcesIncome: num(),
});

export const businessIncomeSchema = z.object({
  businessProfit: num(),
  professionalIncome: num(),
  presumptiveIncome: num(),
});

export const capitalGainsSchema = z.object({
  equityStcg: num(),
  equityLtcg: num(),
  debtStcg: num(),
  debtLtcg: num(),
  propertyGain: num(),
  goldGain: num(),
  cryptoIncome: num(),
});

export const deductionsSchema = z.object({
  section80C: num(),
  section80CCD1B: num(),
  section80DSelf: num(),
  isSelfOrFamilySenior: z.coerce.boolean().default(false),
  section80DParents: num(),
  isParentsSenior: z.coerce.boolean().default(false),
  section80E: num(),
  section80G: num(),
  employerNpsContribution: num(),
  otherDeductions: num(),
});

export const calculateTaxSchema = z.object({
  financialYearCode: z.string().min(1),
  personal: personalDetailsSchema,
  salary: salaryDetailsSchema,
  houseProperty: housePropertySchema,
  otherIncome: otherIncomeSchema,
  businessIncome: businessIncomeSchema,
  capitalGains: capitalGainsSchema,
  deductions: deductionsSchema,
});

export const saveTaxCalculationSchema = z.object({
  financialYearCode: z.string().min(1),
  label: z.string().max(120).optional(),
  selectedRegime: z.enum(["OLD", "NEW"]).optional(),
  inputs: calculateTaxSchema,
  result: z.record(z.unknown()),
});

export const whatIfTaxSchema = calculateTaxSchema.extend({
  overrides: z
    .object({
      section80C: z.coerce.number().min(0).optional(),
      section80CCD1B: z.coerce.number().min(0).optional(),
      section80DSelf: z.coerce.number().min(0).optional(),
      homeLoanInterest: z.coerce.number().min(0).optional(),
      hraReceived: z.coerce.number().min(0).optional(),
      rentPaid: z.coerce.number().min(0).optional(),
    })
    .optional(),
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CalculateTaxInput = z.infer<typeof calculateTaxSchema>;
export type SaveTaxCalculationInput = z.infer<typeof saveTaxCalculationSchema>;
export type WhatIfTaxInput = z.infer<typeof whatIfTaxSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
