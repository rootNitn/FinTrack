/** Returns a [start, end) local-day range for `date` — used to detect same-day duplicate entries
 * (manual expense/income) without worrying about the exact time-of-day component. */
export function dayRange(date: Date): { gte: Date; lt: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}
