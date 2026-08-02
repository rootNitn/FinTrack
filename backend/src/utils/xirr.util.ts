/**
 * XIRR (money-weighted rate of return) calculator.
 *
 * Solves for the annualized rate `r` such that the sum of `amount / (1+r)^(days/365)` across all
 * cash flows equals zero (the standard XNPV=0 definition used by Excel/Google Sheets' XIRR).
 * Used by the Mutual Funds dashboard to compute a per-fund return that correctly accounts for
 * multiple SIP installments made on different dates/amounts (unlike a flat CAGR on totals).
 */

export interface CashFlow {
  /** Negative for money going out (a purchase/investment), positive for money coming back (current value / redemption). */
  amount: number;
  date: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function xnpv(rate: number, cashFlows: CashFlow[], t0: number): number {
  return cashFlows.reduce((sum, cf) => {
    const years = (cf.date.getTime() - t0) / MS_PER_DAY / 365;
    return sum + cf.amount / Math.pow(1 + rate, years);
  }, 0);
}

function xnpvDerivative(rate: number, cashFlows: CashFlow[], t0: number): number {
  return cashFlows.reduce((sum, cf) => {
    const years = (cf.date.getTime() - t0) / MS_PER_DAY / 365;
    if (years === 0) return sum;
    return sum - (years * cf.amount) / Math.pow(1 + rate, years + 1);
  }, 0);
}

/**
 * Computes XIRR for a set of dated cash flows via Newton-Raphson, falling back to a bisection
 * search if Newton-Raphson fails to converge. Returns `null` (rather than throwing) when the
 * inputs are insufficient or no reasonable solution can be found — callers should treat a null
 * result as "not enough data to rate this fund yet" instead of a hard error.
 */
export function calculateXirr(cashFlows: CashFlow[]): number | null {
  if (cashFlows.length < 2) return null;

  const hasPositive = cashFlows.some((cf) => cf.amount > 0);
  const hasNegative = cashFlows.some((cf) => cf.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = sorted[0].date.getTime();

  // Newton-Raphson, starting at a 10% guess.
  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const value = xnpv(rate, sorted, t0);
    const derivative = xnpvDerivative(rate, sorted, t0);
    if (derivative === 0) break;
    const nextRate = rate - value / derivative;
    if (!Number.isFinite(nextRate) || nextRate <= -0.9999) break;
    if (Math.abs(nextRate - rate) < 1e-7) {
      return round(nextRate * 100);
    }
    rate = nextRate;
  }

  // Fallback: bisection search over a wide, plausible rate range.
  let low = -0.9999;
  let high = 10; // 1000% annualized upper bound
  let lowValue = xnpv(low, sorted, t0);
  const highValue = xnpv(high, sorted, t0);
  if (Number.isNaN(lowValue) || Number.isNaN(highValue) || lowValue * highValue > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const midValue = xnpv(mid, sorted, t0);
    if (Math.abs(midValue) < 1e-6) return round(mid * 100);
    if (lowValue * midValue < 0) {
      high = mid;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }

  return round(((low + high) / 2) * 100);
}

function round(value: number): number {
  return Number(value.toFixed(2));
}
