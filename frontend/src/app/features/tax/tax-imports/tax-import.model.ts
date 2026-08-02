export type TaxImportType = 'salary-slip' | 'form16' | 'ais' | 'form26as';

export const TAX_IMPORT_TYPE_LABELS: Record<TaxImportType, string> = {
  'salary-slip': 'Salary Slip',
  form16: 'Form 16',
  ais: 'AIS (Annual Information Statement)',
  form26as: 'Form 26AS',
};

export const TAX_IMPORT_DOCUMENT_ACCEPT: Record<TaxImportType, string> = {
  'salary-slip': '.pdf,.jpg,.jpeg,.png',
  form16: '.pdf,.jpg,.jpeg,.png',
  ais: '.pdf,.xlsx,.xls,.csv',
  form26as: '.pdf,.xlsx,.xls,.csv',
};

export interface TaxImportFieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number';
}

export const SALARY_SLIP_FIELDS: TaxImportFieldConfig[] = [
  { key: 'month', label: 'Month', type: 'text' },
  { key: 'employeeName', label: 'Employee Name', type: 'text' },
  { key: 'employerName', label: 'Employer Name', type: 'text' },
  { key: 'pan', label: 'PAN', type: 'text' },
  { key: 'basicSalary', label: 'Basic Salary', type: 'number' },
  { key: 'hra', label: 'HRA', type: 'number' },
  { key: 'specialAllowance', label: 'Special Allowance', type: 'number' },
  { key: 'conveyance', label: 'Conveyance', type: 'number' },
  { key: 'medicalAllowance', label: 'Medical Allowance', type: 'number' },
  { key: 'lta', label: 'LTA', type: 'number' },
  { key: 'bonus', label: 'Bonus', type: 'number' },
  { key: 'commission', label: 'Commission', type: 'number' },
  { key: 'employerPf', label: 'Employer PF', type: 'number' },
  { key: 'employeePf', label: 'Employee PF', type: 'number' },
  { key: 'professionalTax', label: 'Professional Tax', type: 'number' },
  { key: 'incomeTaxTds', label: 'Income Tax TDS', type: 'number' },
  { key: 'grossSalary', label: 'Gross Salary', type: 'number' },
  { key: 'netSalary', label: 'Net Salary', type: 'number' },
  { key: 'otherAllowances', label: 'Other Allowances', type: 'number' },
];

export const FORM16_FIELDS: TaxImportFieldConfig[] = [
  { key: 'assessmentYear', label: 'Assessment Year', type: 'text' },
  { key: 'employerName', label: 'Employer Name', type: 'text' },
  { key: 'employeeName', label: 'Employee Name', type: 'text' },
  { key: 'pan', label: 'PAN', type: 'text' },
  { key: 'tan', label: 'TAN', type: 'text' },
  { key: 'grossSalary', label: 'Gross Salary', type: 'number' },
  { key: 'exemptions', label: 'Exemptions', type: 'number' },
  { key: 'deductions', label: 'Deductions', type: 'number' },
  { key: 'professionalTax', label: 'Professional Tax', type: 'number' },
  { key: 'standardDeduction', label: 'Standard Deduction', type: 'number' },
  { key: 'employerNpsContribution', label: 'Employer NPS Contribution (80CCD(2))', type: 'number' },
  { key: 'taxableIncome', label: 'Taxable Income', type: 'number' },
  { key: 'tdsDeducted', label: 'TDS Deducted', type: 'number' },
  { key: 'taxDeposited', label: 'Tax Deposited', type: 'number' },
];

export const AIS_FIELDS: TaxImportFieldConfig[] = [
  { key: 'salaryIncome', label: 'Salary Income', type: 'number' },
  { key: 'interestIncome', label: 'Interest Income', type: 'number' },
  { key: 'dividendIncome', label: 'Dividend Income', type: 'number' },
  { key: 'capitalGainsIncome', label: 'Capital Gains Income', type: 'number' },
  { key: 'propertyIncome', label: 'Property Income', type: 'number' },
  { key: 'businessIncome', label: 'Business Income', type: 'number' },
  { key: 'otherIncome', label: 'Other Income', type: 'number' },
  { key: 'taxPaid', label: 'Tax Paid', type: 'number' },
  { key: 'tdsAmount', label: 'TDS Amount', type: 'number' },
  { key: 'tcsAmount', label: 'TCS Amount', type: 'number' },
  { key: 'advanceTax', label: 'Advance Tax', type: 'number' },
];

export const FORM26AS_FIELDS: TaxImportFieldConfig[] = [
  { key: 'employerTds', label: 'Employer TDS', type: 'number' },
  { key: 'bankTds', label: 'Bank TDS', type: 'number' },
  { key: 'dividendTds', label: 'Dividend TDS', type: 'number' },
  { key: 'propertyTds', label: 'Property TDS', type: 'number' },
  { key: 'professionalIncomeTds', label: 'Professional Income TDS', type: 'number' },
  { key: 'advanceTax', label: 'Advance Tax', type: 'number' },
  { key: 'selfAssessmentTax', label: 'Self Assessment Tax', type: 'number' },
  { key: 'refund', label: 'Refund', type: 'number' },
  { key: 'totalTaxPaid', label: 'Total Tax Paid', type: 'number' },
];

export const TAX_IMPORT_FIELD_CONFIGS: Record<TaxImportType, TaxImportFieldConfig[]> = {
  'salary-slip': SALARY_SLIP_FIELDS,
  form16: FORM16_FIELDS,
  ais: AIS_FIELDS,
  form26as: FORM26AS_FIELDS,
};

export interface TaxImportRecord {
  id: string;
  documentId: string;
  userId: string;
  financialYearCode: string;
  isEdited: boolean;
  validationWarnings: string[] | null;
  rawExtractedJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // Document-specific extracted fields are spread in dynamically (see field configs above).
  [key: string]: unknown;
}
