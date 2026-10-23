import { RecurrenceInterval } from "@prisma/client";

/** Number of days in `year`-`month` (0-indexed month, matching `Date`'s convention). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Adds `months` calendar months to `date`, clamping the day-of-month to the last valid day of
 * the target month instead of letting it overflow into the following month (JS `Date`'s default
 * behavior). E.g. Jan 31 + 1 month -> Feb 28/29 (not Mar 3), Mar 31 + 1 month -> Apr 30 (not May 1).
 * Preserves the time-of-day.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const targetMonthIndex = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const day = Math.min(date.getDate(), daysInMonth(targetYear, targetMonth));

  const result = new Date(date);
  result.setFullYear(targetYear, targetMonth, day);
  return result;
}

/**
 * Advances `date` by one WEEKLY/MONTHLY/YEARLY recurrence interval, using month-end-clamped
 * arithmetic for MONTHLY/YEARLY so a day-31 (or Feb-29) recurrence doesn't drift forward a few
 * days every cycle (e.g. Jan 31 -> Feb 28 -> Mar 28 instead of Jan 31 -> Mar 3 -> Apr 3 -> ...).
 */
export function addRecurrenceInterval(date: Date, interval: RecurrenceInterval): Date {
  if (interval === "WEEKLY") {
    const next = new Date(date);
    next.setDate(next.getDate() + 7);
    return next;
  }
  if (interval === "YEARLY") return addMonthsClamped(date, 12);
  return addMonthsClamped(date, 1); // MONTHLY
}

/** Projects a monthly recurring day-of-month (e.g. a SIP debit date) forward to its next
 *  occurrence on/after `from`, clamping to the last day of a shorter month instead of overflowing. */
export function nextMonthlyOccurrence(dayOfMonth: number, from: Date): Date {
  const buildCandidate = (year: number, month: number) =>
    new Date(year, month, Math.min(dayOfMonth, daysInMonth(year, month)));

  const candidate = buildCandidate(from.getFullYear(), from.getMonth());
  if (candidate < from) {
    const nextMonthIndex = from.getMonth() + 1;
    return buildCandidate(from.getFullYear() + Math.floor(nextMonthIndex / 12), ((nextMonthIndex % 12) + 12) % 12);
  }
  return candidate;
}
