export type FdBankType = 'PUBLIC' | 'PRIVATE' | 'SMALL_FINANCE' | 'NBFC';
export type FdDepositType = 'CUMULATIVE' | 'MONTHLY_INTEREST' | 'QUARTERLY_INTEREST';
export type FdCompoundingFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUALLY';
export type FdPortfolioStatus = 'ACTIVE' | 'MATURED' | 'CLOSED' | 'RENEWED';
export type FdType = 'REGULAR' | 'SENIOR';
export type TenureUnit = 'DAYS' | 'MONTHS' | 'YEARS';
export type RateHistoryRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export const FD_BANK_TYPE_LABELS: Record<FdBankType, string> = {
  PUBLIC: 'Public Sector',
  PRIVATE: 'Private Bank',
  SMALL_FINANCE: 'Small Finance Bank',
  NBFC: 'NBFC',
};

export const FD_DEPOSIT_TYPE_LABELS: Record<FdDepositType, string> = {
  CUMULATIVE: 'Cumulative (paid at maturity)',
  MONTHLY_INTEREST: 'Monthly Interest Payout',
  QUARTERLY_INTEREST: 'Quarterly Interest Payout',
};

export const FD_COMPOUNDING_LABELS: Record<FdCompoundingFrequency, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-Yearly',
  ANNUALLY: 'Annually',
};

export interface FdRate {
  id: string;
  tenureLabel: string;
  tenureMinDays: number;
  tenureMaxDays: number;
  interestRate: number;
  seniorCitizenRate: number;
  compounding: FdCompoundingFrequency;
  payoutOptions: string[];
  effectiveDate: string;
}

export interface FdBank {
  id: string;
  name: string;
  logoUrl: string | null;
  bankType: FdBankType;
  rating: number;
  minDeposit: number;
  maxDeposit: number | null;
  depositInsuranceCover: number;
  pros: string[];
  cons: string[];
  features: string[];
  prematureWithdrawalRules: string | null;
  penaltyRules: string | null;
  taxInfo: string | null;
  customerSupportPhone: string | null;
  customerSupportEmail: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  rates: FdRate[];
}

export interface FdComparisonRow {
  rank: number;
  bankId: string;
  bankName: string;
  logoUrl: string | null;
  bankType: FdBankType;
  interestRate: number;
  seniorCitizenRate: number;
  minDeposit: number;
  maxDeposit: number | null;
  tenureLabel: string;
  compounding: FdCompoundingFrequency;
  payoutOptions: string[];
  maturityAmount: number;
  interestEarned: number;
  extraEarned: number;
  rating: number;
  depositInsuranceCover: number;
  lastUpdated: string;
  isHighestMaturity: boolean;
  isHighestRate: boolean;
}

export interface FdComparisonFilters {
  amount?: number;
  tenureDays?: number;
  fdType?: FdType;
  bankTypes?: string;
  depositType?: FdDepositType;
  compounding?: FdCompoundingFrequency;
  minRating?: number;
  search?: string;
  sortBy?: 'interestRate' | 'maturityAmount' | 'bankName' | 'rating' | 'tenure';
  sortDir?: 'asc' | 'desc';
}

export interface FdInterestBreakdownRow {
  period: number;
  periodLabel: string;
  openingBalance: number;
  interestForPeriod: number;
  closingBalance: number;
}

export interface FdCalculationResult {
  principal: number;
  interestEarned: number;
  maturityAmount: number;
  effectiveAnnualYieldPercent: number;
  totalReturnPercent: number;
  maturityDate: string;
  tenureDays: number;
  breakdown: FdInterestBreakdownRow[];
  interestRateUsed: number;
  compoundingUsed: FdCompoundingFrequency;
}

export interface FdCalculateInput {
  principal: number;
  fdType: FdType;
  bankId?: string;
  interestRate?: number;
  depositType: FdDepositType;
  tenureValue: number;
  tenureUnit: TenureUnit;
  compounding: FdCompoundingFrequency;
}

export interface FdRateHistoryPoint {
  recordedAt: string;
  month: string;
  interestRate: number;
}

export interface FdTrendPrediction {
  available: boolean;
  message?: string;
  currentRate?: number;
  predictedRateIn3Months?: number;
  trend?: 'UP' | 'DOWN' | 'FLAT';
  slopePerMonth?: number;
  disclaimer?: string;
}

export interface FdPortfolioEntry {
  id: string;
  userId: string;
  bankId: string | null;
  bankName: string;
  amount: number;
  interestRate: number;
  depositType: FdDepositType;
  compounding: FdCompoundingFrequency;
  openingDate: string;
  maturityDate: string;
  maturityAmount: number;
  nominee: string | null;
  notes: string | null;
  status: FdPortfolioStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FdPortfolioFormValue {
  bankId?: string;
  bankName: string;
  amount: number;
  interestRate: number;
  depositType: FdDepositType;
  compounding: FdCompoundingFrequency;
  openingDate: string;
  maturityDate: string;
  nominee?: string;
  notes?: string;
  status?: FdPortfolioStatus;
}

export interface FdPortfolioSummary {
  portfolioValue: number;
  totalMaturityValue: number;
  totalInterestEarned: number;
  activeCount: number;
  upcomingMaturities: FdPortfolioEntry[];
}

export interface FdFavorite {
  id: string;
  bankId: string;
  bankName: string;
  logoUrl: string | null;
  bankType: FdBankType;
  rating: number;
  createdAt: string;
}

export interface FdLadderPlanInput {
  totalAmount: number;
  fdType: FdType;
  rungs?: number[];
}

export interface FdLadderRung {
  years: number;
  amount: number;
  bestBankName: string | null;
  bestRate: number | null;
  maturityAmount: number | null;
  interestEarned: number | null;
  maturityDate: string | null;
}

export interface FdLadderPlan {
  totalAmount: number;
  totalMaturityValue: number;
  totalInterestEarned: number;
  rungs: FdLadderRung[];
}

export interface FdBankFormValue {
  name: string;
  logoUrl?: string;
  bankType: FdBankType;
  rating: number;
  minDeposit: number;
  maxDeposit?: number;
  depositInsuranceCover: number;
  pros: string[];
  cons: string[];
  features: string[];
  prematureWithdrawalRules?: string;
  penaltyRules?: string;
  taxInfo?: string;
  customerSupportPhone?: string;
  customerSupportEmail?: string;
  websiteUrl?: string;
  isActive: boolean;
}

export interface FdRateFormValue {
  bankId: string;
  tenureLabel: string;
  tenureMinDays: number;
  tenureMaxDays: number;
  interestRate: number;
  seniorCitizenRate: number;
  compounding: FdCompoundingFrequency;
  payoutOptions?: string[];
}

export interface FdImportResult {
  bankCount: number;
  rateCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
}
