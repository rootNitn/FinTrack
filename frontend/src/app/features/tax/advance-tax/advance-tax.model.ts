export type AdvanceTaxQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface AdvanceTaxInstallmentInput {
  quarter: AdvanceTaxQuarter;
  paidAmount: number;
}

export interface AdvanceTaxScheduleRow {
  quarter: AdvanceTaxQuarter;
  dueDate: string;
  cumulativePercentRequired: number;
  requiredCumulativeAmount: number;
  paidCumulativeAmount: number;
  shortfall: number;
  interest234C: number;
}

export interface AdvanceTaxCalculationResult {
  id: string;
  netAssessedTax: number;
  advanceTaxApplicable: boolean;
  totalAdvanceTaxPaid: number;
  schedule: AdvanceTaxScheduleRow[];
  interest234C: number;
  interest234B: {
    applicable: boolean;
    shortfall: number;
    monthsElapsed: number;
    amount: number;
  };
  totalInterest: number;
  totalPayable: number;
}
