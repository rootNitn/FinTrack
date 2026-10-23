export type InvestmentCategory =
  | 'STOCKS'
  | 'MUTUAL_FUNDS'
  | 'FIXED_DEPOSIT'
  | 'PPF'
  | 'EPF'
  | 'NPS'
  | 'GOLD'
  | 'CRYPTO'
  | 'BONDS'
  | 'REAL_ESTATE'
  | 'CASH'
  | 'OTHER';

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH';

export type InvestmentStatus = 'ACTIVE' | 'MATURED' | 'SOLD' | 'CLOSED';

export const INVESTMENT_CATEGORIES: InvestmentCategory[] = [
  'STOCKS',
  'MUTUAL_FUNDS',
  'FIXED_DEPOSIT',
  'PPF',
  'EPF',
  'NPS',
  'GOLD',
  'CRYPTO',
  'BONDS',
  'REAL_ESTATE',
  'CASH',
  'OTHER',
];

export const RISK_LEVELS: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH'];
export const INVESTMENT_STATUSES: InvestmentStatus[] = ['ACTIVE', 'MATURED', 'SOLD', 'CLOSED'];

export type RecurrenceInterval = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type FdTenureUnit = 'DAYS' | 'MONTHS' | 'YEARS';
export type FdDepositType = 'CUMULATIVE' | 'MONTHLY_INTEREST' | 'QUARTERLY_INTEREST';
export type FdCompoundingFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUALLY';

export const RECURRENCE_INTERVALS: RecurrenceInterval[] = ['WEEKLY', 'MONTHLY', 'YEARLY'];

export const INVESTMENT_CATEGORY_LABELS: Record<InvestmentCategory, string> = {
  STOCKS: 'Stocks',
  MUTUAL_FUNDS: 'Mutual Funds',
  FIXED_DEPOSIT: 'Fixed Deposit',
  PPF: 'PPF',
  EPF: 'EPF',
  NPS: 'NPS',
  GOLD: 'Gold',
  CRYPTO: 'Crypto',
  BONDS: 'Bonds',
  REAL_ESTATE: 'Real Estate',
  CASH: 'Cash',
  OTHER: 'Other',
};

export interface InvestmentCategorySummary {
  category: InvestmentCategory;
  count: number;
  totalPrincipal: number;
  totalCurrentValue: number;
  totalTargetValue: number;
  totalProfit: number;
  totalRoiPercent: number;
}

export interface Investment {
  id: string;
  userId: string;
  name: string;
  category: InvestmentCategory;
  account: string | null;
  principalAmount: number;
  currentValue: number;
  targetValue: number | null;
  purchaseDate: string;
  maturityDate: string | null;
  sipAmount: number | null;
  riskLevel: RiskLevel;
  notes: string | null;
  status: InvestmentStatus;
  profit: number;
  roiPercent: number;
  goalId: string | null;
  goalName: string | null;
  familyMemberId?: string | null;
  familyMemberName?: string | null;
  symbol?: string | null;
  units?: number | null;
  purchaseNav?: number | null;
  currentNav?: number | null;
  lastPriceRefreshAt?: string | null;
  /** Broker/statement name this row was imported from (e.g. "ZERODHA"), null for manual entries. */
  broker?: string | null;
  /** "MANUAL" or the importer key (e.g. "GROWW", "ZERODHA", "UPSTOX") that created this row. */
  source?: string | null;
  /** AMFI scheme code resolved during live price refresh, powers the Mutual Funds dashboard. */
  mfSchemeCode?: number | null;
  mfSchemeCategory?: string | null;
  /** ISO 4217 code the holding was originally purchased in (defaults to "INR"). */
  currency: string;
  /** Rate at entry time: 1 unit of `currency` = `exchangeRate` units of the account's base currency. */
  exchangeRate: number;
  isRecurring: boolean;
  recurrenceInterval?: RecurrenceInterval | null;
  recurrenceEndDate?: string | null;
  nextRecurrenceDate?: string | null;
  parentInvestmentId?: string | null;
  fdTenureValue?: number | null;
  fdTenureUnit?: FdTenureUnit | null;
  fdInterestRate?: number | null;
  fdCompounding?: FdCompoundingFrequency | null;
  fdDepositType?: FdDepositType | null;
  fdMaturityAmount?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentFormValue {
  name: string;
  category: InvestmentCategory;
  account?: string | null;
  principalAmount: number;
  currentValue: number;
  targetValue?: number | null;
  purchaseDate: string;
  maturityDate?: string | null;
  sipAmount?: number | null;
  riskLevel: RiskLevel;
  notes?: string | null;
  status: InvestmentStatus;
  goalId?: string | null;
  symbol?: string | null;
  units?: number | null;
  currency?: string;
  exchangeRate?: number;
  familyMemberId?: string | null;
  isRecurring?: boolean;
  recurrenceInterval?: RecurrenceInterval;
  recurrenceEndDate?: string;
  fdTenureValue?: number;
  fdTenureUnit?: FdTenureUnit;
  fdInterestRate?: number;
  fdCompounding?: FdCompoundingFrequency;
  fdDepositType?: FdDepositType;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  insertedCount: number;
  errorCount: number;
  errors: ImportRowError[];
}

export interface InvestmentListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  category?: InvestmentCategory;
  status?: InvestmentStatus;
  riskLevel?: RiskLevel;
  familyMemberId?: string;
}
