export type TaxReportType =
  | 'INCOME_SUMMARY'
  | 'TAX_SUMMARY'
  | 'CAPITAL_GAINS'
  | 'TDS_SUMMARY'
  | 'TAX_SAVING'
  | 'INVESTMENT_SUMMARY';

export interface TaxReportTable {
  title: string;
  financialYearCode: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

export const TAX_REPORT_TYPES: Array<{ value: TaxReportType; label: string }> = [
  { value: 'INCOME_SUMMARY', label: 'Income Summary' },
  { value: 'TAX_SUMMARY', label: 'Tax Summary' },
  { value: 'CAPITAL_GAINS', label: 'Capital Gains Report' },
  { value: 'TDS_SUMMARY', label: 'TDS Report' },
  { value: 'TAX_SAVING', label: 'Tax Saving Report' },
  { value: 'INVESTMENT_SUMMARY', label: 'Investment Report' },
];
