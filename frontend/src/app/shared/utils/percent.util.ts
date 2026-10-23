/**
 * App-wide percentage formatting helper. Standardizes on 2 decimal places and
 * an optional leading "+" for positive values (used for ROI/growth figures).
 */
export function formatPercent(value: number | null | undefined, options?: { digits?: number; signed?: boolean }): string {
  if (value === null || value === undefined || !isFinite(value)) return '—';
  const digits = options?.digits ?? 2;
  const sign = options?.signed && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}
