export interface DashboardKpis {
  netWorth: number;
  totalInvested: number;
  currentValue: number;
  totalProfit: number;
  roiPercent: number;
  goalProgress: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  cashAvailable: number;
}

export interface NamedValue {
  name: string;
  value: number;
}

export interface NetWorthPoint {
  label: string;
  netWorth: number;
}

export interface CurrentVsTargetPoint {
  category: string;
  current: number;
  target: number;
}

export interface ProfitByCategoryPoint {
  category: string;
  profit: number;
}

export interface MonthlyAmountPoint {
  label: string;
  amount: number;
}

export interface IncomeVsExpensePoint {
  label: string;
  income: number;
  expense: number;
}

export interface InvestmentSummary {
  id: string;
  name: string;
  category: string;
  currentValue: number;
  principalAmount: number;
  [key: string]: unknown;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  charts: {
    assetAllocation: NamedValue[];
    netWorthGrowth: NetWorthPoint[];
    currentVsTarget: CurrentVsTargetPoint[];
    profitByCategory: ProfitByCategoryPoint[];
    monthlyInvestmentTrend: MonthlyAmountPoint[];
    expenseBreakdown: NamedValue[];
    incomeVsExpense: IncomeVsExpensePoint[];
    topInvestments: InvestmentSummary[];
  };
}
