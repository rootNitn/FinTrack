export type InvestmentInstrumentType =
  | 'FIXED_DEPOSIT'
  | 'RECURRING_DEPOSIT'
  | 'DEBT_MUTUAL_FUND'
  | 'LIQUID_FUND'
  | 'PPF'
  | 'GOVERNMENT_BOND'
  | 'RBI_FLOATING_RATE_BOND'
  | 'TREASURY_BILL'
  | 'NIFTY_50_INDEX_FUND'
  | 'NIFTY_100_INDEX_FUND'
  | 'LARGE_CAP_FUND'
  | 'MID_CAP_FUND'
  | 'SMALL_CAP_FUND';

export type InvestmentReturnType = 'FIXED' | 'VARIABLE' | 'MARKET_LINKED';
export type InvestmentLiquidityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type InvestmentRiskLevel = 'LOW' | 'LOW_MODERATE' | 'MODERATE' | 'MODERATE_HIGH' | 'HIGH';

export const INVESTMENT_TYPE_LABELS: Record<InvestmentInstrumentType, string> = {
  FIXED_DEPOSIT: 'Fixed Deposit',
  RECURRING_DEPOSIT: 'Recurring Deposit',
  DEBT_MUTUAL_FUND: 'Debt Mutual Fund',
  LIQUID_FUND: 'Liquid Fund',
  PPF: 'Public Provident Fund (PPF)',
  GOVERNMENT_BOND: 'Government Bond (G-Sec)',
  RBI_FLOATING_RATE_BOND: 'RBI Floating Rate Savings Bond',
  TREASURY_BILL: 'Treasury Bill (T-Bill)',
  NIFTY_50_INDEX_FUND: 'Nifty 50 Index Fund',
  NIFTY_100_INDEX_FUND: 'Nifty 100 Index Fund',
  LARGE_CAP_FUND: 'Large Cap Equity Fund',
  MID_CAP_FUND: 'Mid Cap Equity Fund',
  SMALL_CAP_FUND: 'Small Cap Equity Fund',
};

export const RISK_LEVEL_LABELS: Record<InvestmentRiskLevel, string> = {
  LOW: 'Low Risk',
  LOW_MODERATE: 'Low-Moderate Risk',
  MODERATE: 'Moderate Risk',
  MODERATE_HIGH: 'Moderate-High Risk',
  HIGH: 'High Risk',
};

export const LIQUIDITY_LABELS: Record<InvestmentLiquidityLevel, string> = {
  HIGH: 'High Liquidity',
  MEDIUM: 'Medium Liquidity',
  LOW: 'Low Liquidity',
  NONE: 'Not Liquid',
};

export interface InvestmentComparisonRow {
  type: InvestmentInstrumentType;
  label: string;
  category: string;
  description: string;
  returnType: InvestmentReturnType;
  assumedAnnualReturnPercent: number;
  returnRateNote: string;
  isLiveRate: boolean;
  maturityAmount: number;
  interestEarned: number;
  effectiveAnnualYieldPercent: number;
  lockInMonths: number;
  lockInNote: string;
  liquidity: InvestmentLiquidityLevel;
  liquidityNote: string;
  taxation: string;
  riskLevel: InvestmentRiskLevel;
  minInvestment: number;
  isEligible: boolean;
  eligibilityNote?: string;
  calcNote?: string;
  isBestReturn?: boolean;
  isMostLiquid?: boolean;
  isSafest?: boolean;
}

export interface InvestmentComparisonResult {
  amount: number;
  tenureYears: number;
  rows: InvestmentComparisonRow[];
  bestReturnType: InvestmentInstrumentType | null;
  mostLiquidType: InvestmentInstrumentType | null;
  safestType: InvestmentInstrumentType | null;
  disclaimer: string;
}

export interface InvestmentComparisonFilters {
  amount: number;
  tenureYears: number;
  riskLevels?: string;
  sortBy?: 'maturityAmount' | 'assumedAnnualReturnPercent' | 'effectiveAnnualYieldPercent';
  sortDir?: 'asc' | 'desc';
}
