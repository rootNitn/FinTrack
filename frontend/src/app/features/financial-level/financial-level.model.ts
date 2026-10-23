export interface FinancialLevelGate {
  id: string;
  label: string;
  passed: boolean;
  current: number | null;
  target: number;
}

export interface FinancialLevelRecommendation {
  id: string;
  priority: number;
  title: string;
  current: number | null;
  target: number;
  message: string;
}

export interface FinancialIncomeSource {
  id: string;
  name: string;
  type: string;
  mode: 'ACTIVE' | 'PASSIVE' | 'SEMI_PASSIVE';
  monthlyAmount: number;
  percent: number | null;
}

export interface FinancialLevelSummary {
  currentLevel: { name: string; label: string; minimumScore: number; score: number | null };
  nextLevel: { name: string; label: string; minimumScore: number; requiredScore: number } | null;
  scoreChange: number | null;
  gates: FinancialLevelGate[];
  missingRequirements: string[];
  recommendations: FinancialLevelRecommendation[];
  incomeDiversification: {
    sourceCount: number;
    primaryDependencyPercent: number | null;
    status: string;
    sources: FinancialIncomeSource[];
  };
  income: { totalMonthly: number; activeMonthly: number; passiveMonthly: number; passivePercent: number | null };
  incomeReplacementRatio: number | null;
  financialIndependence: { annualExpenses: number | null; fiNumber: number | null; currentCorpus: number; progressPercent: number | null };
  netWorth: { netWorth: number; totalAssets: number; totalLiabilities: number };
}
