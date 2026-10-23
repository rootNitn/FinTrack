import { signal } from '@angular/core';

/**
 * App-wide selected currency code (ISO 4217), seeded from the user's Settings on app bootstrap
 * (see ShellComponent) and updated instantly whenever Settings are saved. All currency-formatted
 * displays across the app should go through `formatCurrency()` below instead of hardcoding a
 * locale/currency, so the Settings > Currency picker actually affects what's shown.
 */
export const currencyCode = signal<string>('INR');

const CURRENCY_LOCALES: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  AUD: 'en-AU',
  CAD: 'en-CA',
  JPY: 'ja-JP',
  SGD: 'en-SG',
};

function localeForCurrency(code: string): string {
  return CURRENCY_LOCALES[code] ?? 'en-US';
}

/** Formats a number as currency using the app-wide selected currency (Settings > Currency). */
export function formatCurrency(value: number, options?: Intl.NumberFormatOptions): string {
  const code = currencyCode();
  const locale = localeForCurrency(code);
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code, ...options }).format(value);
}

/** Formats a number as currency in an explicit (possibly non-account-default) ISO currency code. */
export function formatCurrencyAs(value: number, code: string, options?: Intl.NumberFormatOptions): string {
  const locale = localeForCurrency(code);
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code, ...options }).format(value);
}

/** Formats a plain number using the locale associated with the app-wide selected currency. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeForCurrency(currencyCode()), options).format(value);
}

/** ISO 4217 codes supported by the currency picker (Settings and per-investment currency). */
export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_LOCALES);
