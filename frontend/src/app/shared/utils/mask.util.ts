/**
 * Display-time masking helpers for sensitive identifiers (Feature 19 - Security).
 * These do not affect what's stored/sent to the backend — only what's rendered in the UI.
 */

/** Masks a PAN (e.g. `ABCDE1234F` -> `ABCDE****F`), keeping the first 5 and last 1 characters. */
export function maskPan(pan: string | null | undefined): string {
  if (!pan) {
    return '—';
  }
  const trimmed = pan.trim().toUpperCase();
  if (trimmed.length <= 6) {
    return '*'.repeat(trimmed.length);
  }
  const start = trimmed.slice(0, 5);
  const end = trimmed.slice(-1);
  return `${start}${'*'.repeat(trimmed.length - 6)}${end}`;
}

/** Masks an Aadhaar number (e.g. `123456789012` -> `XXXX XXXX 9012`), keeping only the last 4 digits. */
export function maskAadhaar(aadhaar: string | null | undefined): string {
  if (!aadhaar) {
    return '—';
  }
  const digits = aadhaar.replace(/\s+/g, '');
  if (digits.length <= 4) {
    return digits;
  }
  const last4 = digits.slice(-4);
  return `XXXX XXXX ${last4}`;
}
