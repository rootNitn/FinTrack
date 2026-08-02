export type TaxRegime = 'OLD' | 'NEW';
export type TaxAgeCategory = 'GENERAL' | 'SENIOR' | 'SUPER_SENIOR';
export type TaxGender = 'MALE' | 'FEMALE' | 'OTHER';
export type TaxResidentialStatus = 'RESIDENT' | 'NON_RESIDENT' | 'RNOR';
export type TaxEmploymentType = 'SALARIED' | 'SELF_EMPLOYED' | 'BUSINESS' | 'PENSIONER';
export type TaxHousePropertyType = 'SELF_OCCUPIED' | 'LET_OUT' | 'NONE';

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

export interface TaxPersonalDetails {
  age: number;
  gender: TaxGender;
  residentialStatus: TaxResidentialStatus;
  employmentType: TaxEmploymentType;
  state: string;
}

export interface TaxSalaryDetails {
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

export interface TaxHouseProperty {
  type: TaxHousePropertyType;
  rentalIncome: number;
  municipalTaxes: number;
  homeLoanInterest: number;
}

export interface TaxOtherIncome {
  savingsInterest: number;
  fdInterest: number;
  rdInterest: number;
  dividendIncome: number;
  familyPension: number;
  agricultureIncome: number;
  otherSourcesIncome: number;
}

export interface TaxBusinessIncome {
  businessProfit: number;
  professionalIncome: number;
  presumptiveIncome: number;
}

export interface TaxCapitalGains {
  equityStcg: number;
  equityLtcg: number;
  debtStcg: number;
  debtLtcg: number;
  propertyGain: number;
  goldGain: number;
  cryptoIncome: number;
}

export interface TaxDeductions {
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
  personal: TaxPersonalDetails;
  salary: TaxSalaryDetails;
  houseProperty: TaxHouseProperty;
  otherIncome: TaxOtherIncome;
  businessIncome: TaxBusinessIncome;
  capitalGains: TaxCapitalGains;
  deductions: TaxDeductions;
}

export interface TaxWhatIfOverrides {
  section80C?: number;
  section80CCD1B?: number;
  section80DSelf?: number;
  homeLoanInterest?: number;
  hraReceived?: number;
  rentPaid?: number;
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
  regime: TaxRegime;
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
  recommendedRegime: TaxRegime;
  taxSaved: number;
  suggestions: string[];
}

export interface TaxAiInsight {
  id: string;
  severity: 'info' | 'warning' | 'success';
  title: string;
  message: string;
}

export interface TaxDashboardData {
  financialYearCode: string;
  calculation: {
    id: string;
    createdAt: string;
    recommendedRegime: TaxRegime;
    totalTaxPayable: number;
    taxSaved: number;
    takeHomeIncome: number;
  } | null;
  form26as: {
    totalTaxPaid: number | null;
    refund: number | null;
  } | null;
  advanceTax: {
    id: string;
    totalPayable: number | null;
    totalInterest: number | null;
  } | null;
  taxSavingPlan: {
    id: string;
    topSuggestions: Array<{ code: string; title: string; description: string; potentialTaxSaving: number }>;
  } | null;
  insights: TaxAiInsight[];
}

export interface TaxFinancialYearSummary {
  id: string;
  code: string;
  label: string;
  assessmentYear: string;
  isDefault: boolean;
}

export interface TaxDeductionRule {
  code: string;
  label: string;
  maxLimit: number | null;
  ratePercent: number | null;
  isAllowed: boolean;
}

export interface TaxSlabRule {
  slabOrder: number;
  minIncome: number;
  maxIncome: number | null;
  ratePercent: number;
}

export interface RegimeRuleSet {
  regime: TaxRegime;
  slabsByAge: Record<TaxAgeCategory, TaxSlabRule[]>;
  rebate: { thresholdIncome: number; maxRebateAmount: number; marginalReliefEnabled: boolean } | null;
  surcharge: { slabOrder: number; minIncome: number; maxIncome: number | null; ratePercent: number; marginalReliefEnabled: boolean }[];
  cess: { label: string; ratePercent: number }[];
  deductions: Record<string, TaxDeductionRule>;
}

export interface TaxFinancialYearRuleSet {
  financialYearCode: string;
  label: string;
  assessmentYear: string;
  old: RegimeRuleSet;
  new: RegimeRuleSet;
}

export interface TaxCalculationRecord {
  id: string;
  userId: string;
  financialYearCode: string;
  label: string | null;
  selectedRegime: TaxRegime | null;
  inputs: TaxCalculationInput;
  result: TaxComparisonResult;
  createdAt: string;
  updatedAt: string;
}

export const DEDUCTION_SECTION_LABELS: Record<string, string> = {
  STANDARD_DEDUCTION: 'Standard Deduction',
  SEC_80C: '80C (PPF/EPF/ELSS/Life Insurance/NSC/Tax-saving FD)',
  SEC_80CCD_1B: '80CCD(1B) - Additional NPS',
  SEC_80D_SELF_NON_SENIOR: '80D - Health Insurance (Self)',
  SEC_80D_SELF_SENIOR: '80D - Health Insurance (Self, Senior)',
  SEC_80D_PARENTS_NON_SENIOR: '80D - Health Insurance (Parents)',
  SEC_80D_PARENTS_SENIOR: '80D - Health Insurance (Parents, Senior)',
  SEC_80E: '80E - Education Loan Interest',
  SEC_80G: '80G - Donations',
  SEC_80TTA: '80TTA - Savings Interest',
  SEC_80TTB: '80TTB - Senior Citizen Interest',
  SEC_80CCD_2: '80CCD(2) - Employer NPS',
  HOME_LOAN_SELF_OCCUPIED_INTEREST: 'Home Loan Interest (Self-Occupied)',
  OTHER_DEDUCTIONS: 'Other Deductions',
};
