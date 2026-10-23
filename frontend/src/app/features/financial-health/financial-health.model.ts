export type FinancialHealthStatus = 'good' | 'warning' | 'critical' | 'na';

export interface FinancialHealthRule {
  id: string;
  title: string;
  status: FinancialHealthStatus;
  summary: string;
  recommendation: string;
  data: Record<string, number | null>;
}

export interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  previousNetWorth: number | null;
  growthAmount: number | null;
  growthPercent: number | null;
  yoyNetWorth: number | null;
  yoyGrowthPercent: number | null;
}

export interface ActionPlanItem {
  ruleId: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning';
}

export interface FinancialHealthSummary {
  overallScore: number | null;
  overallStatus: FinancialHealthStatus;
  /** Scored rules (weighted into overallScore) across all 10 categories. */
  rules: FinancialHealthRule[];
  /** Rules of thumb (50/30/20, 100-Age, 60/30/10, Save the Raise, Rule of 72/114/144, FI Ratio) shown as benchmarks — excluded from the score. */
  benchmarks: FinancialHealthRule[];
  netWorth: NetWorthSummary;
  /** Top 3 most urgent recommendations, worst-first. */
  topActions: ActionPlanItem[];
  categoryScores: {
    savings: number | null;
    debt: number | null;
    investments: number | null;
    emergencyFund: number | null;
    insurance: number | null;
    goals: number | null;
    credit: number | null;
  };
}

export type LiabilityType = 'HOME_LOAN' | 'CAR_LOAN' | 'PERSONAL_LOAN' | 'EDUCATION_LOAN' | 'OTHER';

export interface Liability {
  id: string;
  userId: string;
  name: string;
  type: LiabilityType;
  amount: number;
  interestRatePercent: number | null;
  principalAmount: number | null;
  tenureMonths: number | null;
  startDate: string | null;
  emiAmount: number | null;
  familyMemberId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLiabilityPayload {
  name: string;
  type: LiabilityType;
  amount: number;
  interestRatePercent?: number | null;
  principalAmount?: number | null;
  tenureMonths?: number | null;
  startDate?: string | null;
  familyMemberId?: string | null;
}

export interface AmortizationRow {
  month: number;
  date: string;
  emi: number;
  principalComponent: number;
  interestComponent: number;
  balance: number;
}

export interface AmortizationSummary {
  emi: number;
  totalInterest: number;
  totalPayment: number;
  payoffDate: string | null;
  remainingBalance: number;
  remainingMonths: number;
  interestPaidTillDate: number;
  principalPaidTillDate: number;
}

export interface LiabilityAmortization {
  liability: Liability;
  emi: number;
  schedule: AmortizationRow[];
  summary: AmortizationSummary;
}

export interface PrepaymentImpact {
  baseline: { months: number; totalInterest: number; payoffDate: string | null };
  withPrepayment: { months: number; totalInterest: number; payoffDate: string | null; extraMonthlyPayment: number; lumpSum: number };
  monthsSaved: number;
  interestSaved: number;
}

export type DebtPayoffStrategyType = 'AVALANCHE' | 'SNOWBALL';

export interface DebtPayoffLoanResult {
  id: string;
  name: string;
  payoffOrder: number;
  monthsToPayoff: number;
  interestPaid: number;
}

export interface DebtPayoffSimulation {
  strategy: DebtPayoffStrategyType;
  totalMonths: number;
  totalInterestPaid: number;
  loans: DebtPayoffLoanResult[];
}

export interface DebtPayoffStrategyResult {
  eligibleLoans: { id: string; name: string; balance: number; annualRatePercent: number; emi: number }[];
  excludedLiabilities: { id: string; name: string; amount: number }[];
  extraMonthlyBudget: number;
  baseline: { totalMonths: number; totalInterestPaid: number } | null;
  avalanche: DebtPayoffSimulation | null;
  snowball: DebtPayoffSimulation | null;
  betterStrategy: DebtPayoffStrategyType | null;
  interestSavedVsBaseline?: { avalanche: number; snowball: number };
}

export const LIABILITY_TYPE_LABELS: Record<LiabilityType, string> = {
  HOME_LOAN: 'Home Loan',
  CAR_LOAN: 'Car Loan',
  PERSONAL_LOAN: 'Personal Loan',
  EDUCATION_LOAN: 'Education Loan',
  OTHER: 'Other',
};

export type InsuranceType = 'HEALTH' | 'LIFE' | 'OTHER';

export interface InsurancePolicy {
  id: string;
  userId: string;
  type: InsuranceType;
  provider: string | null;
  sumInsured: number;
  premiumAmount: number | null;
  coversFamily: boolean;
  expiryDate: string | null;
  renewalDate: string | null;
  nominee: string | null;
  familyMemberId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInsurancePolicyPayload {
  type: InsuranceType;
  provider?: string | null;
  sumInsured: number;
  premiumAmount?: number | null;
  coversFamily?: boolean;
  expiryDate?: string | null;
  renewalDate?: string | null;
  nominee?: string | null;
  familyMemberId?: string | null;
}

export const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  HEALTH: 'Health',
  LIFE: 'Life',
  OTHER: 'Other',
};

export const FINANCIAL_HEALTH_STATUS_LABELS: Record<FinancialHealthStatus, string> = {
  good: 'On Track',
  warning: 'Needs Attention',
  critical: 'At Risk',
  na: 'Not Enough Data',
};

export const FINANCIAL_HEALTH_STATUS_BADGE_CLASSES: Record<FinancialHealthStatus, string> = {
  good: 'bg-profit/15 text-profit',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  critical: 'bg-loss/15 text-loss',
  na: 'bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50',
};

