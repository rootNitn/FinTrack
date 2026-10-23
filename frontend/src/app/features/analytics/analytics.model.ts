export interface IncomeVsExpensePoint {
  label: string;
  income: number;
  expense: number;
  savings: number;
}

export interface ExpenseHeatmapPoint {
  date: string;
  value: number;
}

export interface SavingsRatePoint {
  label: string;
  income: number;
  expense: number;
  savingsRate: number;
}

export interface NetWorthPoint {
  label: string;
  netWorth: number;
}

export interface CategoryPerformance {
  category: string;
  invested: number;
  currentValue: number;
  profit: number;
  roiPercent: number;
}

export interface InvestmentTrendPoint {
  label: string;
  principalAmount: number;
  investmentValue: number;
}

export interface InvestmentPerformance {
  totalInvested: number;
  currentValue: number;
  totalProfit: number;
  roiPercent: number;
  categoryPerformance: CategoryPerformance[];
  trend: InvestmentTrendPoint[];
}

export interface CategorySpending {
  category: string;
  amount: number;
  percent: number;
}

export interface YearOverYearPoint {
  year: number;
  income: number;
  expense: number;
  savings: number;
  netWorth: number;
  incomeGrowthPercent: number | null;
  expenseGrowthPercent: number | null;
  netWorthGrowthPercent: number | null;
}

export interface AnalyticsResult {
  generatedAt: string;
  incomeVsExpense: IncomeVsExpensePoint[];
  expenseHeatmap: ExpenseHeatmapPoint[];
  monthlySavingsRate: SavingsRatePoint[];
  netWorthGrowth: NetWorthPoint[];
  investmentPerformance: InvestmentPerformance;
  categorySpending: CategorySpending[];
  yearOverYear: YearOverYearPoint[];
}
