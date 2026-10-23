// EMI/amortization math for a standard reducing-balance loan. Pure functions, no DB access,
// so they're trivially unit-testable and reusable from both the schedule and prepayment-impact
// endpoints.

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface AmortizationRow {
  month: number;
  date: string;
  emi: number;
  principalComponent: number;
  interestComponent: number;
  balance: number;
}

export interface LoanTerms {
  principal: number;
  annualRatePercent: number;
  tenureMonths: number;
  startDate: Date;
}

/** Standard reducing-balance EMI formula. Falls back to a straight-line split when the rate is 0. */
export function computeEmi(principal: number, annualRatePercent: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  const monthlyRate = annualRatePercent / 12 / 100;
  if (monthlyRate === 0) return round2(principal / tenureMonths);
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  return round2((principal * monthlyRate * factor) / (factor - 1));
}

/**
 * Builds a full month-by-month amortization schedule. An optional `extraMonthlyPayment` (used by
 * the prepayment-impact what-if) is applied on top of the computed EMI every month, shortening the
 * payoff — the schedule naturally ends early once the balance reaches zero.
 */
export function buildAmortizationSchedule(terms: LoanTerms, extraMonthlyPayment = 0): AmortizationRow[] {
  const { principal, annualRatePercent, tenureMonths, startDate } = terms;
  if (principal <= 0 || tenureMonths <= 0) return [];

  const monthlyRate = annualRatePercent / 12 / 100;
  const emi = computeEmi(principal, annualRatePercent, tenureMonths) + Math.max(0, extraMonthlyPayment);
  const rows: AmortizationRow[] = [];
  let balance = principal;

  for (let month = 1; month <= tenureMonths + 600 && balance > 0; month++) {
    const interestComponent = round2(balance * monthlyRate);
    let principalComponent = round2(emi - interestComponent);
    if (principalComponent <= 0) break; // EMI doesn't even cover interest — invalid terms, stop rather than loop forever
    if (principalComponent > balance) principalComponent = round2(balance);

    balance = round2(balance - principalComponent);
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + month);

    rows.push({
      month,
      date: date.toISOString(),
      emi: round2(principalComponent + interestComponent),
      principalComponent,
      interestComponent,
      balance: Math.max(balance, 0),
    });
  }

  return rows;
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

/** Summarizes a schedule as of `asOfDate` — how much is paid off vs remaining right now. */
export function summarizeAmortization(schedule: AmortizationRow[], asOfDate: Date): AmortizationSummary {
  if (!schedule.length) {
    return {
      emi: 0,
      totalInterest: 0,
      totalPayment: 0,
      payoffDate: null,
      remainingBalance: 0,
      remainingMonths: 0,
      interestPaidTillDate: 0,
      principalPaidTillDate: 0,
    };
  }

  const totalInterest = round2(schedule.reduce((sum, row) => sum + row.interestComponent, 0));
  const totalPayment = round2(schedule.reduce((sum, row) => sum + row.emi, 0));
  const pastRows = schedule.filter((row) => new Date(row.date) <= asOfDate);
  const futureRows = schedule.filter((row) => new Date(row.date) > asOfDate);
  const lastRow = schedule[schedule.length - 1];

  return {
    emi: schedule[0].emi,
    totalInterest,
    totalPayment,
    payoffDate: lastRow.date,
    remainingBalance: pastRows.length ? pastRows[pastRows.length - 1].balance : schedule[0].balance,
    remainingMonths: futureRows.length,
    interestPaidTillDate: round2(pastRows.reduce((sum, row) => sum + row.interestComponent, 0)),
    principalPaidTillDate: round2(pastRows.reduce((sum, row) => sum + row.principalComponent, 0)),
  };
}

export type DebtPayoffStrategy = "AVALANCHE" | "SNOWBALL";

export interface DebtPayoffLoanInput {
  id: string;
  name: string;
  /** Current outstanding balance, as of today (not the original principal). */
  balance: number;
  annualRatePercent: number;
  /** Current minimum monthly payment for this loan. */
  emi: number;
}

export interface DebtPayoffLoanResult {
  id: string;
  name: string;
  payoffOrder: number;
  monthsToPayoff: number;
  interestPaid: number;
}

export interface DebtPayoffSimulationResult {
  strategy: DebtPayoffStrategy;
  totalMonths: number;
  totalInterestPaid: number;
  loans: DebtPayoffLoanResult[];
}

const MAX_SIMULATION_MONTHS = 1200; // 100-year safety cap against runaway loops on bad input

/**
 * Simulates paying off several loans at once with a shared pool of extra monthly cash on top of
 * each loan's own minimum EMI. Every month the ENTIRE extra pool (user's stated extra budget, plus
 * the EMIs of any loans already paid off — the classic "rolling snowball" effect) goes toward one
 * target loan, chosen by the strategy:
 *  - AVALANCHE: highest interest rate first (minimizes total interest paid)
 *  - SNOWBALL: smallest remaining balance first (maximizes early "wins" for motivation)
 * A month-by-month loop is used (rather than a closed-form formula) because the target loan changes
 * over time as balances shrink and loans get paid off.
 */
export function simulateDebtPayoff(
  loans: DebtPayoffLoanInput[],
  extraMonthlyBudget: number,
  strategy: DebtPayoffStrategy
): DebtPayoffSimulationResult {
  const state = loans.map((loan) => ({ ...loan, remaining: round2(loan.balance), interestPaid: 0, paidOffMonth: null as number | null }));
  let month = 0;
  let extraPool = Math.max(0, extraMonthlyBudget);

  while (state.some((loan) => loan.remaining > 0.01) && month < MAX_SIMULATION_MONTHS) {
    month++;
    const active = state.filter((loan) => loan.remaining > 0.01);
    const target =
      strategy === "AVALANCHE"
        ? active.reduce((best, loan) => (loan.annualRatePercent > best.annualRatePercent ? loan : best))
        : active.reduce((best, loan) => (loan.remaining < best.remaining ? loan : best));

    let freedThisMonth = 0;
    for (const loan of active) {
      const monthlyRate = loan.annualRatePercent / 12 / 100;
      const interest = round2(loan.remaining * monthlyRate);
      const payment = loan.id === target.id ? loan.emi + extraPool : loan.emi;
      let principalPaid = round2(payment - interest);
      if (principalPaid > loan.remaining) principalPaid = loan.remaining;
      loan.remaining = round2(Math.max(0, loan.remaining - principalPaid));
      loan.interestPaid = round2(loan.interestPaid + interest);
      if (loan.remaining <= 0.01 && loan.paidOffMonth === null) {
        loan.paidOffMonth = month;
        freedThisMonth += loan.emi;
      }
    }
    extraPool += freedThisMonth;
  }

  const paidOff = [...state].sort((a, b) => (a.paidOffMonth ?? Infinity) - (b.paidOffMonth ?? Infinity));

  return {
    strategy,
    totalMonths: month,
    totalInterestPaid: round2(state.reduce((sum, loan) => sum + loan.interestPaid, 0)),
    loans: paidOff.map((loan, index) => ({
      id: loan.id,
      name: loan.name,
      payoffOrder: index + 1,
      monthsToPayoff: loan.paidOffMonth ?? month,
      interestPaid: loan.interestPaid,
    })),
  };
}
