import { getInstrumentReference, InvestmentInstrumentType } from "./investment-comparison.constants";

const YEAR_DAYS = 365;

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/** Standard lump-sum compound interest: P * (1 + r/n)^(n*t) */
function compoundLumpsum(principal: number, annualRatePercent: number, years: number, compoundsPerYear: number): number {
  const r = annualRatePercent / 100;
  return principal * Math.pow(1 + r / compoundsPerYear, compoundsPerYear * years);
}

/**
 * Recurring Deposit maturity using the future-value-of-an-annuity-due formula with monthly
 * compounding. The entered `amount` is treated as the *total* sum contributed across equal
 * monthly installments over the tenure (installment = amount / months).
 */
function recurringDepositMaturity(totalAmount: number, annualRatePercent: number, years: number): number {
  const months = Math.max(1, Math.round(years * 12));
  const installment = totalAmount / months;
  const i = annualRatePercent / 100 / 12;
  if (i === 0) return installment * months;
  const fv = installment * ((Math.pow(1 + i, months) - 1) / i) * (1 + i);
  return fv;
}

/** Treasury Bills are zero-coupon, discount-priced instruments issued for <= 364 days. */
function treasuryBillMaturity(principal: number, annualRatePercent: number, years: number): { maturity: number; note: string } {
  if (years <= 1) {
    const r = annualRatePercent / 100;
    return { maturity: principal * (1 + r * years), note: "Simple discount yield for a single T-Bill cycle (max 364 days)." };
  }
  // Beyond 1 year, a single T-Bill can't be held — model as annual reinvestment at the same yield.
  return {
    maturity: compoundLumpsum(principal, annualRatePercent, years, 1),
    note: "Assumes reinvestment into a fresh T-Bill every year at the same yield (yields will vary in reality).",
  };
}

export interface InstrumentReturnResult {
  maturityAmount: number;
  interestEarned: number;
  effectiveAnnualYieldPercent: number;
  calcNote?: string;
}

export function computeInstrumentReturn(
  type: InvestmentInstrumentType,
  principal: number,
  tenureYears: number,
  annualRatePercent: number
): InstrumentReturnResult {
  const years = Math.max(tenureYears, 1 / YEAR_DAYS);
  let maturityAmount: number;
  let calcNote: string | undefined;

  switch (type) {
    case "FIXED_DEPOSIT":
      maturityAmount = compoundLumpsum(principal, annualRatePercent, years, 4);
      break;
    case "RECURRING_DEPOSIT":
      maturityAmount = recurringDepositMaturity(principal, annualRatePercent, years);
      calcNote = "Assumes the amount is spread as equal monthly installments over the tenure.";
      break;
    case "DEBT_MUTUAL_FUND":
    case "LIQUID_FUND":
      maturityAmount = compoundLumpsum(principal, annualRatePercent, years, 1);
      break;
    case "PPF":
      maturityAmount = compoundLumpsum(principal, annualRatePercent, years, 1);
      break;
    case "GOVERNMENT_BOND":
      maturityAmount = compoundLumpsum(principal, annualRatePercent, years, 2);
      break;
    case "RBI_FLOATING_RATE_BOND":
      maturityAmount = compoundLumpsum(principal, annualRatePercent, years, 2);
      break;
    case "TREASURY_BILL": {
      const result = treasuryBillMaturity(principal, annualRatePercent, years);
      maturityAmount = result.maturity;
      calcNote = result.note;
      break;
    }
    case "NIFTY_50_INDEX_FUND":
    case "NIFTY_100_INDEX_FUND":
    case "LARGE_CAP_FUND":
    case "MID_CAP_FUND":
    case "SMALL_CAP_FUND":
      maturityAmount = compoundLumpsum(principal, annualRatePercent, years, 1);
      break;
    default:
      maturityAmount = principal;
  }

  const recommendedMinYears = getInstrumentReference(type).recommendedMinYears;
  if (recommendedMinYears && tenureYears < recommendedMinYears) {
    calcNote = `Equity returns are volatile short-term; a holding period of ${recommendedMinYears}+ years is recommended for this instrument.`;
  }

  const interestEarned = maturityAmount - principal;
  const effectiveAnnualYieldPercent = years > 0 ? (Math.pow(maturityAmount / principal, 1 / years) - 1) * 100 : 0;

  return {
    maturityAmount: round2(maturityAmount),
    interestEarned: round2(interestEarned),
    effectiveAnnualYieldPercent: round2(effectiveAnnualYieldPercent),
    calcNote,
  };
}
