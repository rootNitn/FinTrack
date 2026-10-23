import { FdPortfolioStatus, InvestmentStatus } from "@prisma/client";
import { prisma } from "../config/prisma";

/**
 * Single source of truth for the core financial formulas reused across dashboard, analytics,
 * ai-insights, reports, goals, investments and financial-health. Modules should import from here
 * instead of re-implementing rounding/ROI/savings-rate/net-worth/goal-progress math locally.
 */

export function round2(value: number): number {
  return Number((value || 0).toFixed(2));
}

/** ROI % = profit / principal * 100 (0 if principal is 0, to avoid divide-by-zero). */
export function computeRoiPercent(principal: number, currentValue: number): number {
  if (principal <= 0) return 0;
  return round2(((currentValue - principal) / principal) * 100);
}

/** Savings = income - expense; savingsRatePercent = savings / income * 100 (0 if income is 0). */
export function computeSavingsRate(income: number, expense: number): { savings: number; savingsRatePercent: number } {
  const savings = income - expense;
  const savingsRatePercent = income > 0 ? round2((savings / income) * 100) : 0;
  return { savings: round2(savings), savingsRatePercent };
}

/** progressPercent clamped to 100; remainingAmount clamped to 0 (never negative). */
export function computeGoalProgress(current: number, target: number): { progressPercent: number; remainingAmount: number } {
  const progressPercent = target > 0 ? Math.min(100, round2((current / target) * 100)) : 0;
  const remainingAmount = round2(Math.max(0, target - current));
  return { progressPercent, remainingAmount };
}

/**
 * Required level monthly SIP to grow `currentAmount` into `targetAmount` over `months`, assuming
 * `annualReturnPercent` compounds monthly and each month's contribution is invested at the start of
 * the month (annuity due — same convention as the Calculators' SIP/Retirement tools). Falls back to
 * a plain linear split (`remaining / months`) when no return is assumed (0%) — this is the same
 * number the naive pre-existing formula produced, so goals without an assumption behave unchanged.
 */
export function computeRequiredSip(currentAmount: number, targetAmount: number, months: number, annualReturnPercent: number): number {
  if (months <= 0) return 0;
  const monthlyRate = annualReturnPercent / 12 / 100;
  const projectedCurrentValue = monthlyRate > 0 ? currentAmount * Math.pow(1 + monthlyRate, months) : currentAmount;
  const remaining = Math.max(0, targetAmount - projectedCurrentValue);
  if (remaining === 0) return 0;

  if (monthlyRate === 0) return round2(remaining / months);

  const growthFactor = ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
  return round2(remaining / growthFactor);
}

export interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  previousNetWorth: number | null;
  growthAmount: number | null;
  growthPercent: number | null;
  yoyNetWorth: number | null;
  yoyGrowthPercent: number | null;
}

/** Net Worth = Total Assets − Total Liabilities, with optional MoM/YoY growth if prior values are supplied. */
export function computeNetWorth(
  totalAssets: number,
  totalLiabilities: number,
  previousNetWorth: number | null = null,
  yoyNetWorth: number | null = null,
): NetWorthSummary {
  const netWorth = round2(totalAssets - totalLiabilities);

  const growthAmount = previousNetWorth !== null ? round2(netWorth - previousNetWorth) : null;
  const growthPercent =
    previousNetWorth !== null && previousNetWorth !== 0 ? round2((growthAmount! / Math.abs(previousNetWorth)) * 100) : null;

  const yoyGrowthPercent =
    yoyNetWorth !== null && yoyNetWorth !== 0 ? round2(((netWorth - yoyNetWorth) / Math.abs(yoyNetWorth)) * 100) : null;

  return {
    totalAssets: round2(totalAssets),
    totalLiabilities: round2(totalLiabilities),
    netWorth,
    previousNetWorth: previousNetWorth !== null ? round2(previousNetWorth) : null,
    growthAmount,
    growthPercent,
    yoyNetWorth: yoyNetWorth !== null ? round2(yoyNetWorth) : null,
    yoyGrowthPercent,
  };
}

/**
 * Queries every asset/liability source (bank accounts, active FDs, active investments, credit
 * cards, manual liabilities) for a user and returns the fully-accounted Net Worth — the same
 * "assets minus liabilities" formula financial-health uses, so Dashboard/Analytics/AI Insights/
 * Reports no longer under-count net worth by ignoring FDs, credit-card debt and liabilities.
 */
export async function computeUserNetWorth(
  userId: string,
  previousNetWorth: number | null = null,
  yoyNetWorth: number | null = null,
): Promise<NetWorthSummary> {
  const [bankAccounts, fds, investments, creditCards, liabilities] = await Promise.all([
    prisma.bankAccount.findMany({ where: { userId } }),
    prisma.fdPortfolio.findMany({ where: { userId, status: FdPortfolioStatus.ACTIVE } }),
    prisma.investment.findMany({ where: { userId, status: InvestmentStatus.ACTIVE } }),
    prisma.creditCard.findMany({ where: { userId } }),
    prisma.liability.findMany({ where: { userId } }),
  ]);

  const bankBalance = bankAccounts.reduce((sum, b) => sum + Number(b.balance), 0);
  const fdBalance = fds.reduce((sum, fd) => sum + Number(fd.amount), 0);
  const investmentValue = investments.reduce((sum, i) => sum + Number(i.currentValue), 0);
  const creditCardOutstanding = creditCards.reduce((sum, c) => sum + Number(c.currentOutstanding), 0);
  const manualLiabilities = liabilities.reduce((sum, l) => sum + Number(l.amount), 0);

  const totalAssets = bankBalance + fdBalance + investmentValue;
  const totalLiabilities = creditCardOutstanding + manualLiabilities;

  return computeNetWorth(totalAssets, totalLiabilities, previousNetWorth, yoyNetWorth);
}
