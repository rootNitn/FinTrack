/**
 * Static reference data for the "Best Investment Comparison" tool.
 *
 * Only Fixed Deposits have a live rate source (the FdRateProvider, backed by the FD module's
 * bank/rate tables). Every other instrument here is a broad market instrument without a
 * per-issuer database in this app, so we use conservative, clearly-labelled indicative rates
 * that an admin can tune later. Kept in one place so future live-API integration (e.g. RBI
 * bond yields, AMFI NAV-based CAGR) only needs to replace `assumedAnnualReturnPercent`.
 */

export type InvestmentInstrumentType =
  | "FIXED_DEPOSIT"
  | "RECURRING_DEPOSIT"
  | "DEBT_MUTUAL_FUND"
  | "LIQUID_FUND"
  | "PPF"
  | "GOVERNMENT_BOND"
  | "RBI_FLOATING_RATE_BOND"
  | "TREASURY_BILL"
  | "NIFTY_50_INDEX_FUND"
  | "NIFTY_100_INDEX_FUND"
  | "LARGE_CAP_FUND"
  | "MID_CAP_FUND"
  | "SMALL_CAP_FUND";

export type ReturnType = "FIXED" | "VARIABLE" | "MARKET_LINKED";
export type LiquidityLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type RiskLevel = "LOW" | "LOW_MODERATE" | "MODERATE" | "MODERATE_HIGH" | "HIGH";

export interface InstrumentReference {
  type: InvestmentInstrumentType;
  label: string;
  category: string;
  description: string;
  returnType: ReturnType;
  assumedAnnualReturnPercent: number;
  returnRateNote: string;
  lockInMonths: number;
  lockInNote: string;
  liquidity: LiquidityLevel;
  liquidityNote: string;
  taxation: string;
  riskLevel: RiskLevel;
  minInvestment: number;
  maxTenureYears: number | null;
  minTenureYears: number;
  /** Recommended minimum holding horizon for market-linked equity instruments (advisory, not a hard rule). */
  recommendedMinYears?: number;
}

export const INSTRUMENT_REFERENCE: InstrumentReference[] = [
  {
    type: "FIXED_DEPOSIT",
    label: "Fixed Deposit",
    category: "Bank Deposit",
    description: "Lump-sum deposit with a bank/NBFC at a fixed rate for a chosen tenure.",
    returnType: "FIXED",
    assumedAnnualReturnPercent: 7.0,
    returnRateNote: "Best available live rate for the requested tenure",
    lockInMonths: 0,
    lockInNote: "No formal lock-in; premature withdrawal usually allowed with a penalty (0.5%-1%).",
    liquidity: "MEDIUM",
    liquidityNote: "Premature withdrawal possible with penalty",
    taxation: "Interest fully taxable at your slab rate; TDS above ₹40,000/year (₹50,000 for seniors).",
    riskLevel: "LOW",
    minInvestment: 1000,
    maxTenureYears: 10,
    minTenureYears: 0.02,
  },
  {
    type: "RECURRING_DEPOSIT",
    label: "Recurring Deposit",
    category: "Bank Deposit",
    description: "Fixed monthly installments over a tenure, compounded quarterly like an FD.",
    returnType: "FIXED",
    assumedAnnualReturnPercent: 6.75,
    returnRateNote: "Indicative average bank RD rate",
    lockInMonths: 0,
    lockInNote: "No formal lock-in; premature closure allowed with a penalty.",
    liquidity: "MEDIUM",
    liquidityNote: "Premature withdrawal possible with penalty",
    taxation: "Interest fully taxable at your slab rate; TDS above ₹40,000/year (₹50,000 for seniors).",
    riskLevel: "LOW",
    minInvestment: 100,
    maxTenureYears: 10,
    minTenureYears: 0.5,
  },
  {
    type: "DEBT_MUTUAL_FUND",
    label: "Debt Mutual Fund",
    category: "Market Linked",
    description: "Open-ended fund investing in bonds/debt securities; returns are market-linked (NAV based).",
    returnType: "MARKET_LINKED",
    assumedAnnualReturnPercent: 7.25,
    returnRateNote: "Indicative long-term CAGR, not guaranteed",
    lockInMonths: 0,
    lockInNote: "No lock-in (open-ended); exit load may apply if redeemed within ~1 year.",
    liquidity: "HIGH",
    liquidityNote: "Redemption usually credited within T+1 working day",
    taxation: "Gains taxed at your slab rate (as per current debt-fund taxation rules).",
    riskLevel: "LOW_MODERATE",
    minInvestment: 500,
    maxTenureYears: null,
    minTenureYears: 0.08,
  },
  {
    type: "LIQUID_FUND",
    label: "Liquid Fund",
    category: "Market Linked",
    description: "Debt fund investing in very short-term money-market instruments (up to ~91 days).",
    returnType: "MARKET_LINKED",
    assumedAnnualReturnPercent: 6.9,
    returnRateNote: "Indicative recent-year CAGR, not guaranteed",
    lockInMonths: 0,
    lockInNote: "No lock-in; ideal for parking money short-term.",
    liquidity: "HIGH",
    liquidityNote: "Instant/T+1 redemption in most funds",
    taxation: "Gains taxed at your slab rate (as per current debt-fund taxation rules).",
    riskLevel: "LOW",
    minInvestment: 500,
    maxTenureYears: null,
    minTenureYears: 0.02,
  },
  {
    type: "PPF",
    label: "Public Provident Fund (PPF)",
    category: "Govt Scheme",
    description: "Government-backed long-term savings scheme with a mandatory 15-year tenure.",
    returnType: "FIXED",
    assumedAnnualReturnPercent: 7.1,
    returnRateNote: "Current govt-notified PPF rate (reviewed quarterly)",
    lockInMonths: 180,
    lockInNote: "15-year mandatory lock-in (partial withdrawal allowed from year 7); extendable in 5-year blocks.",
    liquidity: "LOW",
    liquidityNote: "Locked for 15 years; limited partial withdrawals after year 7",
    taxation: "EEE status — contribution, interest, and maturity are all tax-free.",
    riskLevel: "LOW",
    minInvestment: 500,
    maxTenureYears: null,
    minTenureYears: 15,
  },
  {
    type: "GOVERNMENT_BOND",
    label: "Government Bond (G-Sec)",
    category: "Govt Security",
    description: "Sovereign-backed long-term debt security issued by the Government of India.",
    returnType: "FIXED",
    assumedAnnualReturnPercent: 7.15,
    returnRateNote: "Indicative 10-year G-Sec yield",
    lockInMonths: 0,
    lockInNote: "No lock-in; can be sold on the secondary market before maturity (subject to market price).",
    liquidity: "MEDIUM",
    liquidityNote: "Tradable on exchanges, but price fluctuates with interest rates",
    taxation: "Interest fully taxable at your slab rate; capital gains rules apply if sold before maturity.",
    riskLevel: "LOW",
    minInvestment: 1000,
    maxTenureYears: 40,
    minTenureYears: 5,
  },
  {
    type: "RBI_FLOATING_RATE_BOND",
    label: "RBI Floating Rate Savings Bond",
    category: "Govt Security",
    description: "Govt of India savings bond with a floating rate reset every 6 months (linked to NSC rate + 0.35%).",
    returnType: "VARIABLE",
    assumedAnnualReturnPercent: 8.05,
    returnRateNote: "Current floating rate; resets every 6 months, so future rates may differ",
    lockInMonths: 84,
    lockInNote: "7-year fixed tenure; premature encashment only for senior citizens (from year 4-6, with a penalty).",
    liquidity: "NONE",
    liquidityNote: "Not tradable/transferable; premature exit restricted to eligible senior citizens",
    taxation: "Interest fully taxable at your slab rate; TDS applicable.",
    riskLevel: "LOW",
    minInvestment: 1000,
    maxTenureYears: 7,
    minTenureYears: 7,
  },
  {
    type: "TREASURY_BILL",
    label: "Treasury Bill (T-Bill)",
    category: "Govt Security",
    description: "Short-term (91/182/364-day) zero-coupon govt security, issued at a discount to face value.",
    returnType: "FIXED",
    assumedAnnualReturnPercent: 6.8,
    returnRateNote: "Indicative 364-day T-Bill cut-off yield",
    lockInMonths: 0,
    lockInNote: "No lock-in; matures within a year — needs reinvestment for longer horizons.",
    liquidity: "MEDIUM",
    liquidityNote: "Tradable on the secondary market before maturity",
    taxation: "Discount earned (gain) is taxable at your slab rate as short-term capital gains/interest.",
    riskLevel: "LOW",
    minInvestment: 25000,
    maxTenureYears: 1,
    minTenureYears: 0.25,
  },
  {
    type: "NIFTY_50_INDEX_FUND",
    label: "Nifty 50 Index Fund",
    category: "Equity Fund",
    description: "Passively tracks the Nifty 50 index (top 50 NSE-listed large-cap companies).",
    returnType: "MARKET_LINKED",
    assumedAnnualReturnPercent: 12.0,
    returnRateNote: "Indicative long-term CAGR, not guaranteed",
    lockInMonths: 0,
    lockInNote: "No lock-in (open-ended); exit load (~1%) may apply if redeemed within ~1 year.",
    liquidity: "HIGH",
    liquidityNote: "Redemption typically credited within T+2/T+3 working days",
    taxation: "Equity taxation: LTCG (>1 year) taxed at 12.5% above ₹1.25 lakh exemption/year; STCG (≤1 year) taxed at 20%.",
    riskLevel: "MODERATE_HIGH",
    minInvestment: 500,
    maxTenureYears: null,
    minTenureYears: 0.08,
    recommendedMinYears: 3,
  },
  {
    type: "NIFTY_100_INDEX_FUND",
    label: "Nifty 100 Index Fund",
    category: "Equity Fund",
    description: "Passively tracks the Nifty 100 index (top 100 NSE-listed large-cap companies).",
    returnType: "MARKET_LINKED",
    assumedAnnualReturnPercent: 12.3,
    returnRateNote: "Indicative long-term CAGR, not guaranteed",
    lockInMonths: 0,
    lockInNote: "No lock-in (open-ended); exit load (~1%) may apply if redeemed within ~1 year.",
    liquidity: "HIGH",
    liquidityNote: "Redemption typically credited within T+2/T+3 working days",
    taxation: "Equity taxation: LTCG (>1 year) taxed at 12.5% above ₹1.25 lakh exemption/year; STCG (≤1 year) taxed at 20%.",
    riskLevel: "MODERATE_HIGH",
    minInvestment: 500,
    maxTenureYears: null,
    minTenureYears: 0.08,
    recommendedMinYears: 3,
  },
  {
    type: "LARGE_CAP_FUND",
    label: "Large Cap Equity Fund",
    category: "Equity Fund",
    description: "Actively/passively managed fund investing predominantly in the top 100 large-cap companies.",
    returnType: "MARKET_LINKED",
    assumedAnnualReturnPercent: 12.5,
    returnRateNote: "Indicative long-term CAGR, not guaranteed",
    lockInMonths: 0,
    lockInNote: "No lock-in (open-ended); exit load (~1%) may apply if redeemed within ~1 year.",
    liquidity: "HIGH",
    liquidityNote: "Redemption typically credited within T+2/T+3 working days",
    taxation: "Equity taxation: LTCG (>1 year) taxed at 12.5% above ₹1.25 lakh exemption/year; STCG (≤1 year) taxed at 20%.",
    riskLevel: "MODERATE_HIGH",
    minInvestment: 500,
    maxTenureYears: null,
    minTenureYears: 0.08,
    recommendedMinYears: 3,
  },
  {
    type: "MID_CAP_FUND",
    label: "Mid Cap Equity Fund",
    category: "Equity Fund",
    description: "Invests in companies ranked ~101st-250th by market cap; higher growth potential with higher volatility.",
    returnType: "MARKET_LINKED",
    assumedAnnualReturnPercent: 14.5,
    returnRateNote: "Indicative long-term CAGR, not guaranteed",
    lockInMonths: 0,
    lockInNote: "No lock-in (open-ended); exit load (~1%) may apply if redeemed within ~1 year.",
    liquidity: "HIGH",
    liquidityNote: "Redemption typically credited within T+2/T+3 working days",
    taxation: "Equity taxation: LTCG (>1 year) taxed at 12.5% above ₹1.25 lakh exemption/year; STCG (≤1 year) taxed at 20%.",
    riskLevel: "HIGH",
    minInvestment: 500,
    maxTenureYears: null,
    minTenureYears: 0.08,
    recommendedMinYears: 5,
  },
  {
    type: "SMALL_CAP_FUND",
    label: "Small Cap Equity Fund",
    category: "Equity Fund",
    description: "Invests in companies ranked 251st onward by market cap; highest growth potential with highest volatility.",
    returnType: "MARKET_LINKED",
    assumedAnnualReturnPercent: 16.0,
    returnRateNote: "Indicative long-term CAGR, not guaranteed",
    lockInMonths: 0,
    lockInNote: "No lock-in (open-ended); exit load (~1%) may apply if redeemed within ~1 year.",
    liquidity: "HIGH",
    liquidityNote: "Redemption typically credited within T+2/T+3 working days",
    taxation: "Equity taxation: LTCG (>1 year) taxed at 12.5% above ₹1.25 lakh exemption/year; STCG (≤1 year) taxed at 20%.",
    riskLevel: "HIGH",
    minInvestment: 500,
    maxTenureYears: null,
    minTenureYears: 0.08,
    recommendedMinYears: 7,
  },
];

export function getInstrumentReference(type: InvestmentInstrumentType): InstrumentReference {
  const found = INSTRUMENT_REFERENCE.find((i) => i.type === type);
  if (!found) throw new Error(`Unknown investment instrument type: ${type}`);
  return found;
}
