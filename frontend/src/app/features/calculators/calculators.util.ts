import { CalculatorChartData } from './calculators.model';
import { formatPercent as formatPercentShared } from '../../shared/utils/percent.util';
import { formatCurrency as formatCurrencyShared, formatNumber as formatNumberShared } from '../../shared/utils/currency.util';

export function formatCurrency(value: number): string {
  if (!isFinite(value)) return '—';
  return formatCurrencyShared(value, { maximumFractionDigits: 0 });
}

/** Compact currency for axis labels, e.g. ₹12L, ₹1.2Cr. */
export function formatCompactCurrency(value: number): string {
  if (!isFinite(value)) return '—';
  return formatCurrencyShared(value, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
}

/** Recovers the raw number from a value previously formatted by formatCurrency/formatNumber. */
export function parseFormattedNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  return cleaned ? parseFloat(cleaned) : 0;
}

/** Builds a line/bar chart's series data out of already-computed breakdown rows. */
export function chartFromRows(
  rows: Record<string, string | number>[],
  categoryKey: string,
  series: { key: string; name: string }[],
  type: 'line' | 'bar' = 'line',
  stacked = false
): CalculatorChartData {
  return {
    type,
    stacked,
    categories: rows.map((r) => `Yr ${r[categoryKey]}`),
    series: series.map((s) => ({ name: s.name, data: rows.map((r) => parseFormattedNumber(r[s.key])) })),
  };
}

export function formatPercent(value: number, digits = 2): string {
  return formatPercentShared(value, { digits });
}

export function formatNumber(value: number, digits = 0): string {
  if (!isFinite(value)) return '—';
  return formatNumberShared(value, { maximumFractionDigits: digits });
}

/** Future value of a level monthly SIP (deposit-then-compound, ordinary annuity due). */
export function futureValueOfSip(monthlyAmount: number, annualRatePercent: number, months: number): number {
  const i = annualRatePercent / 12 / 100;
  if (months <= 0) return 0;
  if (i === 0) return monthlyAmount * months;
  return monthlyAmount * ((Math.pow(1 + i, months) - 1) / i) * (1 + i);
}

/** EMI for a fully amortizing loan. */
export function emiAmount(principal: number, annualRatePercent: number, months: number): number {
  const i = annualRatePercent / 12 / 100;
  if (months <= 0) return 0;
  if (i === 0) return principal / months;
  const factor = Math.pow(1 + i, months);
  return (principal * i * factor) / (factor - 1);
}

/** Year-wise invested vs. accumulated value for a level monthly SIP. */
export function sipYearlyBreakdown(monthly: number, annualRate: number, years: number): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  const safeYears = Math.max(Math.round(years), 0);
  for (let y = 1; y <= safeYears; y++) {
    const months = y * 12;
    const invested = monthly * months;
    const value = futureValueOfSip(monthly, annualRate, months);
    rows.push({ year: y, invested: formatCurrency(invested), value: formatCurrency(value), gain: formatCurrency(value - invested) });
  }
  return rows;
}

/** Year-wise value for a lump-sum compounding at `compoundsPerYear` times a year. */
export function compoundYearlyBreakdown(
  principal: number,
  annualRate: number,
  years: number,
  compoundsPerYear: number
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  const safeYears = Math.max(Math.round(years), 0);
  const n = compoundsPerYear > 0 ? compoundsPerYear : 1;
  for (let y = 1; y <= safeYears; y++) {
    const value = principal * Math.pow(1 + annualRate / 100 / n, n * y);
    rows.push({ year: y, value: formatCurrency(value), interest: formatCurrency(value - principal) });
  }
  return rows;
}

/** Year-wise amortization summary (principal paid, interest paid, remaining balance). */
export function loanYearlyBreakdown(principal: number, annualRate: number, months: number): Record<string, string | number>[] {
  const i = annualRate / 12 / 100;
  const emi = emiAmount(principal, annualRate, months);
  const rows: Record<string, string | number>[] = [];
  let balance = principal;
  let year = 1;
  let yearPrincipal = 0;
  let yearInterest = 0;
  const safeMonths = Math.max(Math.round(months), 0);
  for (let m = 1; m <= safeMonths; m++) {
    const interestPortion = balance * i;
    const principalPortion = Math.min(emi - interestPortion, balance);
    balance = Math.max(balance - principalPortion, 0);
    yearPrincipal += principalPortion;
    yearInterest += interestPortion;
    if (m % 12 === 0 || m === safeMonths) {
      rows.push({
        year,
        principalPaid: formatCurrency(yearPrincipal),
        interestPaid: formatCurrency(yearInterest),
        balance: formatCurrency(balance),
      });
      year++;
      yearPrincipal = 0;
      yearInterest = 0;
    }
  }
  return rows;
}
