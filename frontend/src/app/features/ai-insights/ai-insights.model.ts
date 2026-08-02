export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface SpendingCategoryTrend {
  category: string;
  currentMonthAmount: number;
  previousMonthAmount: number;
  changePercent: number | null;
  isUnusual: boolean;
  actionLink?: string;
}

export interface SpendingAnalysis {
  currentMonthTotal: number;
  previousMonthTotal: number;
  changePercent: number | null;
  topCategories: SpendingCategoryTrend[];
  unusualCategories: SpendingCategoryTrend[];
  insights: string[];
}

export interface AssetAllocationSlice {
  category: string;
  value: number;
  percent: number;
}

export interface InvestmentSuggestion {
  title: string;
  message: string;
  severity: InsightSeverity;
  actionLink?: string;
}

export interface InvestmentSuggestions {
  currentAllocation: AssetAllocationSlice[];
  totalValue: number;
  growthPercent: number;
  safePercent: number;
  averageGoalHorizonYears: number | null;
  riskProfileHint: 'CONSERVATIVE' | 'BALANCED' | 'GROWTH' | 'UNKNOWN';
  suggestions: InvestmentSuggestion[];
}

export interface MonthlyFinancialSummary {
  month: number;
  year: number;
  income: number;
  expenses: number;
  savings: number;
  savingsRatePercent: number;
  investmentValue: number;
  netWorth: number;
  profit: number;
  previousMonth: { income: number; expenses: number; savings: number };
  incomeChangePercent: number | null;
  expenseChangePercent: number | null;
  savingsChangePercent: number | null;
}

export interface SavingsOpportunity {
  title: string;
  message: string;
  potentialMonthlySavings?: number;
  severity: InsightSeverity;
  actionLink?: string;
}

export interface SavingsOpportunities {
  opportunities: SavingsOpportunity[];
  idleCash: number;
  averageMonthlyExpenses: number;
  recurringSharePercent: number;
}

export interface BudgetAlert {
  category: string | null;
  budgetAmount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  severity: InsightSeverity;
  message: string;
  actionLink?: string;
}

export interface BudgetAlerts {
  alerts: BudgetAlert[];
  hasBudgets: boolean;
  unbudgetedCategories: { category: string; spent: number }[];
}

export interface GoalRecommendation {
  goalId: string;
  name: string;
  type: string;
  progressPercent: number;
  remainingAmount: number;
  monthsRemaining: number | null;
  requiredMonthlyContribution: number | null;
  status: 'ACHIEVED' | 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'OVERDUE';
  message: string;
  actionLink?: string;
}

export interface GoalRecommendations {
  recommendations: GoalRecommendation[];
  averageMonthlySavings: number;
}

export interface PortfolioInsights {
  totalValue: number;
  totalInvested: number;
  totalProfit: number;
  roiPercent: number;
  riskDistribution: { riskLevel: string; value: number; percent: number }[];
  concentration: { category: string; percent: number } | null;
  upcomingMaturities: { id: string; name: string; maturityDate: string; currentValue: number }[];
  insights: string[];
}

export interface AiInsightsResult {
  generatedAt: string;
  spendingAnalysis: SpendingAnalysis;
  investmentSuggestions: InvestmentSuggestions;
  monthlySummary: MonthlyFinancialSummary;
  savingsOpportunities: SavingsOpportunities;
  budgetAlerts: BudgetAlerts;
  goalRecommendations: GoalRecommendations;
  portfolioInsights: PortfolioInsights;
}

export const SEVERITY_BADGE_CLASSES: Record<InsightSeverity, string> = {
  info: 'bg-primary/15 text-primary',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  critical: 'bg-loss/15 text-loss',
};

export const GOAL_STATUS_LABELS: Record<GoalRecommendation['status'], string> = {
  ACHIEVED: 'Achieved',
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  BEHIND: 'Behind',
  OVERDUE: 'Overdue',
};

export const GOAL_STATUS_BADGE_CLASSES: Record<GoalRecommendation['status'], string> = {
  ACHIEVED: 'bg-profit/15 text-profit',
  ON_TRACK: 'bg-profit/15 text-profit',
  AT_RISK: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  BEHIND: 'bg-loss/15 text-loss',
  OVERDUE: 'bg-loss/15 text-loss',
};
