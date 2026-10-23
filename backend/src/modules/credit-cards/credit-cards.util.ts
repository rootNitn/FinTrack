import { CC_DUE_SOON_DAYS, CC_UTILIZATION_THRESHOLDS, UtilizationLevel } from "./credit-cards.constants";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function round2(value: number): number {
  return Number((value || 0).toFixed(2));
}

/** Masks a card number, showing only the last 4 digits, e.g. `\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 1234`. */
export function maskCardNumber(last4: string): string {
  return `\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${last4}`;
}

export function utilizationPercent(outstanding: number, limit: number): number {
  if (limit <= 0) return 0;
  return round2((outstanding / limit) * 100);
}

/** Auto-accrual for a statement lacking an explicit rewardPointsEarned/cashbackEarned value —
 * `ratePercent` is "points/₹ per ₹100 of spend", so the math is identical to a percentage.
 * Returns 0 when the card has no configured rate (null/undefined), i.e. no silent accrual. */
export function accrueFromRate(spend: number, ratePercent: number | null | undefined): number {
  if (!ratePercent || spend <= 0) return 0;
  return round2(spend * (ratePercent / 100));
}

export function utilizationLevel(percent: number): UtilizationLevel {
  if (percent >= CC_UTILIZATION_THRESHOLDS.critical) return "CRITICAL";
  if (percent >= CC_UTILIZATION_THRESHOLDS.high) return "HIGH";
  if (percent >= CC_UTILIZATION_THRESHOLDS.moderate) return "MODERATE";
  return "LOW";
}

export function daysUntil(date: Date, reference: Date = new Date()): number {
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

export function isDueSoon(daysUntilDue: number): boolean {
  return daysUntilDue >= 0 && daysUntilDue <= CC_DUE_SOON_DAYS;
}

/** Computes a hypothetical next statement due date from the card's billing-cycle config. */
export function computeNextDueDate(statementDay: number, paymentDueDays: number, reference: Date = new Date()): Date {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const lastDay = (targetYear: number, targetMonth: number) => new Date(targetYear, targetMonth + 1, 0).getDate();
  let statementDate = new Date(year, month, Math.min(statementDay, lastDay(year, month)));
  if (statementDate <= reference) {
    const nextMonth = month + 1;
    statementDate = new Date(year, nextMonth, Math.min(statementDay, lastDay(year, nextMonth)));
  }
  return new Date(statementDate.getTime() + paymentDueDays * MS_PER_DAY);
}

/** Derives a statement's status from its due date and how much has been paid. */
export function deriveStatementStatus(totalDue: number, paidAmount: number, dueDate: Date, reference: Date = new Date()): "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" {
  if (paidAmount >= totalDue && totalDue > 0) return "PAID";
  if (dueDate.getTime() < reference.getTime()) return "OVERDUE";
  if (paidAmount > 0) return "PARTIALLY_PAID";
  return "UNPAID";
}
