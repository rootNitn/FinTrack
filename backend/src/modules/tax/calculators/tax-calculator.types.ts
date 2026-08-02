import { TaxAgeCategory, TaxRegimeType } from "@prisma/client";

/** A single DB-driven slab (see `TaxSlab` model) shaped for the calculation engine. */
export interface SlabRule {
  slabOrder: number;
  minIncome: number;
  maxIncome: number | null;
  ratePercent: number;
}

export interface RebateRule {
  thresholdIncome: number;
  maxRebateAmount: number;
  marginalReliefEnabled: boolean;
}

export interface SurchargeRule {
  slabOrder: number;
  minIncome: number;
  maxIncome: number | null;
  ratePercent: number;
  marginalReliefEnabled: boolean;
}

export interface CessRule {
  label: string;
  ratePercent: number;
}

export interface DeductionRule {
  code: string;
  label: string;
  maxLimit: number | null;
  ratePercent: number | null;
  isAllowed: boolean;
}

/** Everything the calculation engine needs for one regime of one financial year — entirely
 * loaded from the database (see `TaxRulesService`), never hardcoded in a calculator. */
export interface RegimeRuleSet {
  regime: TaxRegimeType;
  slabsByAge: Record<TaxAgeCategory, SlabRule[]>;
  rebate: RebateRule | null;
  surcharge: SurchargeRule[];
  cess: CessRule[];
  deductions: Record<string, DeductionRule>;
}

export interface TaxFinancialYearRuleSet {
  financialYearCode: string;
  label: string;
  assessmentYear: string;
  old: RegimeRuleSet;
  new: RegimeRuleSet;
}

export type EmploymentType = "SALARIED" | "SELF_EMPLOYED" | "BUSINESS" | "PENSIONER";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type ResidentialStatus = "RESIDENT" | "NON_RESIDENT" | "RNOR";
export type HousePropertyType = "SELF_OCCUPIED" | "LET_OUT" | "NONE";

export interface PersonalDetailsInput {
  age: number;
  gender: Gender;
  residentialStatus: ResidentialStatus;
  employmentType: EmploymentType;
  state: string;
}

export interface SalaryDetailsInput {
  basicSalary: number;
  hraReceived: number;
  rentPaid: number;
  specialAllowance: number;
  bonus: number;
  commission: number;
  employerPf: number;
  employeePf: number;
  gratuity: number;
  leaveEncashment: number;
  otherAllowances: number;
  perquisites: number;
  professionalTax: number;
}

export interface HousePropertyInput {
  type: HousePropertyType;
  rentalIncome: number;
  municipalTaxes: number;
  homeLoanInterest: number;
}

export interface OtherIncomeInput {
  savingsInterest: number;
  fdInterest: number;
  rdInterest: number;
  dividendIncome: number;
  familyPension: number;
  agricultureIncome: number;
  otherSourcesIncome: number;
}

export interface BusinessIncomeInput {
  businessProfit: number;
  professionalIncome: number;
  presumptiveIncome: number;
}

export interface CapitalGainsInput {
  equityStcg: number;
  equityLtcg: number;
  debtStcg: number;
  debtLtcg: number;
  propertyGain: number;
  goldGain: number;
  cryptoIncome: number;
}

export interface DeductionsInput {
  section80C: number;
  section80CCD1B: number;
  section80DSelf: number;
  isSelfOrFamilySenior: boolean;
  section80DParents: number;
  isParentsSenior: boolean;
  section80E: number;
  section80G: number;
  employerNpsContribution: number;
  otherDeductions: number;
}

export interface TaxCalculationInput {
  financialYearCode: string;
  personal: PersonalDetailsInput;
  salary: SalaryDetailsInput;
  houseProperty: HousePropertyInput;
  otherIncome: OtherIncomeInput;
  businessIncome: BusinessIncomeInput;
  capitalGains: CapitalGainsInput;
  deductions: DeductionsInput;
}

export interface SlabTaxBreakdownRow {
  slabLabel: string;
  minIncome: number;
  maxIncome: number | null;
  ratePercent: number;
  taxableInThisSlab: number;
  taxForThisSlab: number;
}

export interface IncomeBreakdown {
  salaryIncome: number;
  housePropertyIncome: number;
  otherSourcesIncome: number;
  businessIncome: number;
  capitalGainsSlabTaxed: number;
  grossTotalIncome: number;
}

export interface CapitalGainsTaxBreakdown {
  equityStcgTax: number;
  equityLtcgTax: number;
  debtLtcgTax: number;
  propertyGainTax: number;
  goldGainTax: number;
  cryptoTax: number;
  totalSpecialRateTax: number;
  debtStcgAddedToSlabIncome: number;
}

export interface DeductionApplied {
  code: string;
  label: string;
  claimed: number;
  allowed: number;
}

export interface RegimeResult {
  regime: TaxRegimeType;
  incomeBreakdown: IncomeBreakdown;
  deductionsApplied: DeductionApplied[];
  totalDeductions: number;
  taxableIncome: number;
  slabTaxBreakdown: SlabTaxBreakdownRow[];
  taxOnSlabIncome: number;
  capitalGainsTax: CapitalGainsTaxBreakdown;
  taxBeforeRebate: number;
  rebateAmount: number;
  taxAfterRebate: number;
  surchargeAmount: number;
  taxAfterSurcharge: number;
  marginalReliefApplied: number;
  cessAmount: number;
  totalTaxPayable: number;
  effectiveTaxRatePercent: number;
  takeHomeIncome: number;
}

export interface TaxComparisonResult {
  financialYearCode: string;
  old: RegimeResult;
  new: RegimeResult;
  recommendedRegime: TaxRegimeType;
  taxSaved: number;
  suggestions: string[];
}

/** Strategy pattern contract — one implementation per regime (see `OldRegimeCalculator`,
 * `NewRegimeCalculator`). `TaxCalculatorContext` picks the right implementation at runtime. */
export interface TaxCalculator {
  readonly regime: TaxRegimeType;
  calculate(input: TaxCalculationInput, rules: RegimeRuleSet): RegimeResult;
}
