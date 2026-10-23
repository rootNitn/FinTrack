/**
 * App-wide date formatting helpers. All date displays should go through these
 * instead of calling `.toLocaleDateString()`/`.toLocaleString()` directly, so
 * dates render consistently (e.g. "11 Aug 2026") regardless of browser locale.
 */
export function formatDate(value: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...options });
}

/** Compact date without the year, e.g. "11 Aug" — for dense table cells. */
export function formatDateShort(value: string | Date | null | undefined): string {
  return formatDate(value, { year: undefined });
}

/** Date with time, e.g. "11 Aug 2026, 3:45 pm". */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
