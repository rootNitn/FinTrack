import { TaxAgeCategory, TaxRegime } from './tax.model';

export interface TaxFinancialYearAdmin {
  id: string;
  code: string;
  label: string;
  assessmentYear: string;
  startDate: string;
  endDate: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface TaxFinancialYearDetail extends TaxFinancialYearAdmin {
  slabs: TaxSlabAdmin[];
  rebateRules: TaxRebateRuleAdmin[];
  surchargeRules: TaxSurchargeRuleAdmin[];
  cessRules: TaxCessRuleAdmin[];
  deductionRules: TaxDeductionRuleAdmin[];
}

export interface TaxSlabAdmin {
  id: string;
  financialYearId: string;
  regime: TaxRegime;
  ageCategory: TaxAgeCategory;
  slabOrder: number;
  minIncome: number;
  maxIncome: number | null;
  ratePercent: number;
}

export interface TaxRebateRuleAdmin {
  id: string;
  financialYearId: string;
  regime: TaxRegime;
  thresholdIncome: number;
  maxRebateAmount: number;
  marginalReliefEnabled: boolean;
}

export interface TaxSurchargeRuleAdmin {
  id: string;
  financialYearId: string;
  regime: TaxRegime;
  slabOrder: number;
  minIncome: number;
  maxIncome: number | null;
  ratePercent: number;
  marginalReliefEnabled: boolean;
}

export interface TaxCessRuleAdmin {
  id: string;
  financialYearId: string;
  label: string;
  ratePercent: number;
}

export interface TaxDeductionRuleAdmin {
  id: string;
  financialYearId: string;
  regime: TaxRegime;
  code: string;
  label: string;
  maxLimit: number | null;
  ratePercent: number | null;
  isAllowed: boolean;
}

export type CapitalGainAssetTypeAdmin = 'STOCK' | 'MUTUAL_FUND' | 'PROPERTY' | 'GOLD' | 'CRYPTO';
export type CapitalGainTermTypeAdmin = 'SHORT' | 'LONG';

export interface TaxCapitalGainRuleAdmin {
  id: string;
  assetType: CapitalGainAssetTypeAdmin;
  termType: CapitalGainTermTypeAdmin;
  ratePercent: number;
  exemptionLimit: number | null;
  indexationAllowed: boolean;
}

export interface CostInflationIndexAdmin {
  id: string;
  year: string;
  ciiValue: number;
}

export type TaxDocumentTypeAdmin = 'SALARY_SLIP' | 'FORM16' | 'AIS' | 'FORM26AS' | 'CAPITAL_GAINS_STATEMENT' | 'OTHER';

export interface TaxValidationRuleAdmin {
  id: string;
  documentType: TaxDocumentTypeAdmin;
  fieldName: string;
  condition: string;
  tolerance: number;
  message: string;
  isActive: boolean;
}

