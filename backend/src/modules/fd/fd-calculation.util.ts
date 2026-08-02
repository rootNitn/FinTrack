import { FdCompoundingFrequency, FdDepositType } from "@prisma/client";

export type TenureUnit = "DAYS" | "MONTHS" | "YEARS";

export interface FdCalculationInput {
  principal: number;
  annualRatePercent: number;
  tenureValue: number;
  tenureUnit: TenureUnit;
  depositType: FdDepositType;
  compounding: FdCompoundingFrequency;
  startDate?: Date;
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
}

const COMPOUNDS_PER_YEAR: Record<FdCompoundingFrequency, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  HALF_YEARLY: 2,
  ANNUALLY: 1,
};

/** Converts a user-entered tenure (in days/months/years) into a whole number of days. */
export function tenureToDays(value: number, unit: TenureUnit): number {
  if (unit === "DAYS") return Math.round(value);
  if (unit === "MONTHS") return Math.round(value * 30);
  return Math.round(value * 365);
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/** Effective annual yield for a given nominal annual rate compounded `n` times a year. */
export function effectiveAnnualYield(annualRatePercent: number, compounding: FdCompoundingFrequency): number {
  const n = COMPOUNDS_PER_YEAR[compounding];
  const r = annualRatePercent / 100;
  return round2((Math.pow(1 + r / n, n) - 1) * 100);
}

/**
 * Computes FD maturity figures for the three supported deposit types:
 *  - CUMULATIVE: interest compounds and is paid out with principal at maturity.
 *  - MONTHLY_INTEREST / QUARTERLY_INTEREST: interest is paid out periodically at a discounted
 *    rate (equivalent to the compounding frequency), principal is returned unchanged at maturity.
 */
export function calculateFd(input: FdCalculationInput): FdCalculationResult {
  const tenureDays = tenureToDays(input.tenureValue, input.tenureUnit);
  const tenureYears = tenureDays / 365;
  const n = COMPOUNDS_PER_YEAR[input.compounding];
  const r = input.annualRatePercent / 100;
  const principal = input.principal;

  const startDate = input.startDate ?? new Date();
  const maturityDate = new Date(startDate);
  maturityDate.setDate(maturityDate.getDate() + tenureDays);

  const breakdown: FdInterestBreakdownRow[] = [];
  let maturityAmount: number;
  let interestEarned: number;

  if (input.depositType === "CUMULATIVE") {
    // Year-by-year (or shorter, for sub-year tenures) compounding breakdown.
    const totalPeriods = Math.max(1, Math.round(tenureYears));
    let balance = principal;
    for (let y = 1; y <= totalPeriods; y++) {
      const yearsElapsed = Math.min(y, tenureYears) - (y - 1);
      const opening = balance;
      const closing = principal * Math.pow(1 + r / n, n * Math.min(y, tenureYears));
      breakdown.push({
        period: y,
        periodLabel: `Year ${y}`,
        openingBalance: round2(opening),
        interestForPeriod: round2(closing - opening),
        closingBalance: round2(closing),
      });
      balance = closing;
      void yearsElapsed;
    }
    maturityAmount = principal * Math.pow(1 + r / n, n * tenureYears);
    interestEarned = maturityAmount - principal;
  } else {
    // Periodic payout: the payout rate reflects the same compounding effect as `n`,
    // discounted to the payout frequency (monthly = 12/yr, quarterly = 4/yr).
    const payoutsPerYear = input.depositType === "MONTHLY_INTEREST" ? 12 : 4;
    const payoutAmount = principal * (Math.pow(1 + r / n, n / payoutsPerYear) - 1);
    const totalPayouts = Math.max(1, Math.round((tenureDays / 365) * payoutsPerYear));

    for (let p = 1; p <= totalPayouts; p++) {
      breakdown.push({
        period: p,
        periodLabel: input.depositType === "MONTHLY_INTEREST" ? `Month ${p}` : `Quarter ${p}`,
        openingBalance: round2(principal),
        interestForPeriod: round2(payoutAmount),
        closingBalance: round2(principal),
      });
    }

    interestEarned = payoutAmount * totalPayouts;
    maturityAmount = principal; // principal returned at maturity; interest already paid out periodically
  }

  return {
    principal: round2(principal),
    interestEarned: round2(interestEarned),
    maturityAmount: round2(maturityAmount),
    effectiveAnnualYieldPercent: effectiveAnnualYield(input.annualRatePercent, input.compounding),
    totalReturnPercent: principal > 0 ? round2((interestEarned / principal) * 100) : 0,
    maturityDate: maturityDate.toISOString(),
    tenureDays,
    breakdown,
  };
}
