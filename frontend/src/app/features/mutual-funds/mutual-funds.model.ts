export type MutualFundRating =
  | 'OUTPERFORMING'
  | 'IN_LINE'
  | 'UNDERPERFORMING'
  | 'GOOD'
  | 'AVERAGE'
  | 'POOR';

export type MutualFundRatingBasis = 'BENCHMARK' | 'ABSOLUTE';

export const MUTUAL_FUND_RATING_LABELS: Record<MutualFundRating, string> = {
  OUTPERFORMING: 'Outperforming',
  IN_LINE: 'In line',
  UNDERPERFORMING: 'Underperforming',
  GOOD: 'Good',
  AVERAGE: 'Average',
  POOR: 'Poor',
};

/** Tailwind utility classes for the colored rating chip — green/amber/red per rating. */
export const MUTUAL_FUND_RATING_CLASSES: Record<MutualFundRating, string> = {
  OUTPERFORMING: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  GOOD: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  IN_LINE: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  AVERAGE: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  UNDERPERFORMING: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  POOR: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
};

export interface MutualFundHolding {
  key: string;
  name: string;
  categoryLabel: string;
  units: number | null;
  investedAmount: number;
  currentValue: number;
  profit: number;
  profitPercent: number;
  xirrPercent: number | null;
  benchmarkPercent: number | null;
  benchmarkLabel: string | null;
  rating: MutualFundRating | null;
  ratingBasis: MutualFundRatingBasis | null;
  lastRefreshAt: string | null;
  needsRefresh: boolean;
  longTermInvested: number;
  shortTermInvested: number;
  longTermValue: number;
  shortTermValue: number;
  longTermPercent: number;
}

export interface MutualFundAllocationSlice {
  label: string;
  value: number;
}

export interface MutualFundTermBreakdownRow {
  label: string;
  investedAmount: number;
  currentValue: number;
  profit: number;
  profitPercent: number;
}

export interface MutualFundCategoryBreakdownRow {
  label: string;
  fundCount: number;
  investedAmount: number;
  currentValue: number;
  profit: number;
  profitPercent: number;
}

export interface MutualFundDashboardSummary {
  totalInvested: number;
  totalCurrentValue: number;
  totalProfit: number;
  totalProfitPercent: number;
  overallXirrPercent: number | null;
  fundCount: number;
  ratingCounts: Partial<Record<MutualFundRating, number>>;
  totalLongTermValue: number;
  totalShortTermValue: number;
}

export interface MutualFundDashboard {
  summary: MutualFundDashboardSummary;
  allocation: MutualFundAllocationSlice[];
  categoryBreakdown: MutualFundCategoryBreakdownRow[];
  termBreakdown: MutualFundTermBreakdownRow[];
  funds: MutualFundHolding[];
}

export type MutualFundSortKey =
  | 'name'
  | 'categoryLabel'
  | 'investedAmount'
  | 'currentValue'
  | 'profitPercent'
  | 'xirrPercent';

export interface MutualFundTransaction {
  id: string;
  purchaseDate: string;
  principalAmount: number;
  currentValue: number;
  profit: number;
  units: number | null;
  purchaseNav: number | null;
  currentNav: number | null;
  isRecurring: boolean;
  recurrenceInterval: 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null;
  nextRecurrenceDate: string | null;
}

export interface MutualFundSipInfo {
  installmentCount: number;
  recurrenceInterval: 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null;
  nextRecurrenceDate: string | null;
  latestInstallmentAmount: number;
}

export interface MutualFundDetail extends Omit<MutualFundHolding, 'longTermPercent'> {
  mfSchemeCode: number | null;
  sipInfo: MutualFundSipInfo | null;
  transactions: MutualFundTransaction[];
}
