export type ReportType = 'monthly' | 'quarterly' | 'yearly' | 'investment' | 'expense' | 'goal';

export const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'monthly', label: 'Monthly Summary' },
  { value: 'quarterly', label: 'Quarterly Summary' },
  { value: 'yearly', label: 'Yearly Summary' },
  { value: 'investment', label: 'Investment Report' },
  { value: 'expense', label: 'Expense Report' },
  { value: 'goal', label: 'Goal Report' },
];

export interface ReportQuery {
  type: ReportType;
  month?: number;
  quarter?: number;
  year?: number;
  from?: string;
  to?: string;
}

export interface PeriodReport {
  type: 'monthly' | 'quarterly' | 'yearly';
  period: string;
  from: string;
  to: string;
  income: number;
  expenses: number;
  savings: number;
  investmentValue: number;
  netWorth: number;
  profit: number;
}

export interface InvestmentReportRow {
  id: string;
  name: string;
  category: string;
  principalAmount: number;
  currentValue: number;
  profit: number;
  roiPercent: number;
  status: string;
}

export interface InvestmentReport {
  type: 'investment';
  rows: InvestmentReportRow[];
  totals: { invested: number; currentValue: number; profit: number; roiPercent: number };
}

export interface ExpenseReportRow {
  id: string;
  date: string;
  category: string;
  amount: number;
  description?: string | null;
}

export interface ExpenseReport {
  type: 'expense';
  rows: ExpenseReportRow[];
  byCategory: { category: string; amount: number }[];
  total: number;
}

export interface GoalReportRow {
  id: string;
  name: string;
  type: string;
  targetAmount: number;
  currentAmount: number;
  progressPercent: number;
  remainingAmount: number;
  deadline: string;
}

export interface GoalReport {
  type: 'goal';
  rows: GoalReportRow[];
}

export type Report = PeriodReport | InvestmentReport | ExpenseReport | GoalReport;
