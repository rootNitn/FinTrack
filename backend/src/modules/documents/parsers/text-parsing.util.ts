/**
 * Shared heuristic text-parsing helpers used by every `DocumentParser<T>` implementation.
 * Extraction is regex/keyword based (no cloud OCR/AI) — every parsed value is surfaced to the
 * user for review/edit before it is saved (see Phase 2 plan), so "best effort" heuristics here
 * are acceptable as long as they degrade to `undefined` rather than throwing.
 */

/** Matches a rupee amount like "1,23,456.78", "123456", "Rs. 12,000", "₹12000.00". */
const AMOUNT_TOKEN = /(?:₹|rs\.?)?\s*-?[\d,]+(?:\.\d{1,2})?/i;

function parseAmountToken(token: string): number | undefined {
  const cleaned = token.replace(/[₹,]/gi, "").replace(/rs\.?/i, "").trim();
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Returns true for tokens that look like real currency figures (has a decimal point, or has
 * at least 3 digits) as opposed to small bare digit fragments like "9", "11", "17" that come
 * from row/section numbering (e.g. "12. Total taxable income") or formula references in
 * brackets (e.g. "(9-11)", "[1(d)-2(i)]", "(13+15+16-14)") which are extremely common in
 * official tax forms (Form 16 Part B numbers every line 1-21 and cross-references them).
 * Without this filter, `findAmount` frequently picks up a stray "2" or "-11" instead of the
 * actual amount on the line.
 */
function isCurrencyLike(token: string): boolean {
  if (/\.\d{1,2}$/.test(token)) return true;
  return token.replace(/[^\d]/g, "").length >= 3;
}

/**
 * Finds a line containing one of `labels` (case-insensitive) that also has at least one
 * currency-like amount token (see `isCurrencyLike`) and returns the last such token on that
 * line — this handles the common "Label .......... 12,345.00" layout as well as "Label: 12345"
 * and tabular/space-separated extraction output. Lines that match a label but only contain bare
 * small digit fragments (section numbers, formula cross-references, act years, etc.) are
 * skipped in favor of a later matching line that has a genuine amount, rather than returning a
 * clearly-wrong value.
 */
export function findAmount(text: string, labels: string[]): number | undefined {
  const lines = text.split(/\r?\n/);
  const lowerLabels = labels.map((l) => l.toLowerCase());
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLabels.some((label) => lowerLine.includes(label))) {
      const matches = line.match(new RegExp(AMOUNT_TOKEN, "gi"));
      if (matches && matches.length > 0) {
        const currencyLike = matches.filter(isCurrencyLike);
        if (currencyLike.length > 0) {
          const value = parseAmountToken(currencyLike[currencyLike.length - 1]);
          if (value !== undefined) return value;
        }
      }
    }
  }
  return undefined;
}

/**
 * Sums `findAmount(text, labels)` across several independent label groups, treating each group as
 * a distinct income/deduction line item that should be added together rather than picked from
 * (e.g. an AIS/TIS statement lists "Interest from savings bank" and "Interest from deposit" as two
 * separate rows that both contribute to total interest income). Unlike calling `findAmount` once
 * with all labels combined — which stops at the FIRST matching line and silently drops every other
 * matching line — this sums a value from each group independently. Returns `undefined` (not `0`)
 * if none of the groups matched anything, so callers can still distinguish "not found" from "found
 * as zero".
 */
export function findAmountSum(text: string, labelGroups: string[][]): number | undefined {
  let total = 0;
  let found = false;
  for (const labels of labelGroups) {
    const value = findAmount(text, labels);
    if (value !== undefined) {
      total += value;
      found = true;
    }
  }
  return found ? total : undefined;
}

/** Finds the first line containing one of `labels` and returns the trailing free-text value. */
export function findText(text: string, labels: string[]): string | undefined {
  const lines = text.split(/\r?\n/);
  const lowerLabels = labels.map((l) => l.toLowerCase());
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const matchedLabel = lowerLabels.find((label) => lowerLine.includes(label));
    if (matchedLabel) {
      const idx = lowerLine.indexOf(matchedLabel);
      const rest = line.slice(idx + matchedLabel.length).replace(/^[\s:.\-–|\t]+/, "").trim();
      if (rest) return rest;
    }
  }
  return undefined;
}

/** Extracts the first valid-looking Indian PAN (e.g. ABCDE1234F) found anywhere in the text. */
export function findPan(text: string): string | undefined {
  const match = text.match(/[A-Z]{5}[0-9]{4}[A-Z]/);
  return match ? match[0] : undefined;
}

/** Extracts the first valid-looking TAN (e.g. ABCD12345E) found anywhere in the text. */
export function findTan(text: string): string | undefined {
  const match = text.match(/[A-Z]{4}[0-9]{5}[A-Z]/);
  return match ? match[0] : undefined;
}

/**
 * Returns the LAST match of `pattern` found anywhere in the text (as opposed to the first).
 * Useful for documents with a fixed, standardized layout where a value of interest is known to
 * always appear after a similarly-shaped but different value — e.g. Form 16's Part A always
 * lists "PAN of the Deductor" (employer) before "PAN of the Employee", so a blind first-match
 * PAN search picks up the wrong one; the employee's PAN is reliably the last PAN-shaped token.
 */
export function findLastMatch(text: string, pattern: RegExp): string | undefined {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matches = text.match(new RegExp(pattern.source, flags));
  return matches && matches.length > 0 ? matches[matches.length - 1] : undefined;
}

/**
 * Finds the first line containing `label` and returns the first regex match found starting on
 * that same line and scanning up to `lookaheadLines` lines forward. This is needed for documents
 * (e.g. Form 16) where a value can appear on the line *after* its label (table cell wrap), and
 * where a blind whole-document search (like plain `findPan`) would incorrectly match an earlier,
 * unrelated occurrence of the same value shape (e.g. Form 16 lists the deductor/employer's PAN
 * before the employee's PAN — a global PAN regex grabs the wrong one).
 */
export function findNear(text: string, label: string, valueRegex: RegExp, lookaheadLines = 3): string | undefined {
  const lines = text.split(/\r?\n/);
  const lowerLabel = label.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(lowerLabel)) {
      for (let j = i; j < Math.min(lines.length, i + 1 + lookaheadLines); j++) {
        const match = lines[j].match(valueRegex);
        if (match) return match[0];
      }
    }
  }
  return undefined;
}

/**
 * Finds the first line containing one of `labels` and returns the next non-empty line after it.
 * Handles table layouts where a header label (e.g. "Name and address of the Employer") occupies
 * its own line/cell and the actual value is on the following line, rather than trailing text on
 * the same line as the label (which `findText` assumes).
 */
export function findNextNonEmptyLine(text: string, labels: string[]): string | undefined {
  const lines = text.split(/\r?\n/);
  const lowerLabels = labels.map((l) => l.toLowerCase());
  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase();
    if (lowerLabels.some((label) => lowerLine.includes(label))) {
      for (let j = i + 1; j < lines.length; j++) {
        const candidate = lines[j].trim();
        if (candidate) return candidate;
      }
    }
  }
  return undefined;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Extracts a month name (e.g. "April") if present anywhere in the text, for Salary Slips. */
export function findMonth(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const month of MONTHS) {
    if (lower.includes(month)) return month.charAt(0).toUpperCase() + month.slice(1);
  }
  return undefined;
}

/** Extracts a 4-digit assessment/financial year like "2025-26" or "2025-2026". */
export function findYearCode(text: string): string | undefined {
  const match = text.match(/\b(20\d{2})\s*[-\/]\s*(\d{2,4})\b/);
  return match ? `${match[1]}-${match[2].length === 4 ? match[2].slice(2) : match[2]}` : undefined;
}
