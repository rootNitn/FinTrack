function round2(value: number): number {
  return Number((value || 0).toFixed(2));
}

/** First instant of the given date's month. */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Last instant of the given date's month. */
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Builds `count` consecutive month buckets ending with the current month (oldest first).
 * Each bucket carries its own `[from, to]` date range plus a stable `key` for map lookups.
 */
function buildMonthBuckets(count: number, reference = new Date()): Array<{ key: string; month: number; year: number; from: Date; to: Date }> {
  const buckets: Array<{ key: string; month: number; year: number; from: Date; to: Date }> = [];
  for (let i = count - 1; i >= 0; i--) {
    const cursor = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    buckets.push({
      key: monthKey(cursor),
      month: cursor.getMonth() + 1,
      year: cursor.getFullYear(),
      from: startOfMonth(cursor),
      to: endOfMonth(cursor),
    });
  }
  return buckets;
}

/** Whole months between `from` and a future `to` (never negative). */
function monthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return Math.max(0, months);
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return round2(((current - previous) / previous) * 100);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  const variance = average(values.map((v) => (v - mean) ** 2));
  return Math.sqrt(variance);
}

export { round2, startOfMonth, endOfMonth, monthKey, buildMonthBuckets, monthsBetween, percentChange, average, standardDeviation };
