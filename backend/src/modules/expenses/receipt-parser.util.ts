import { ExpenseCategory } from "@prisma/client";

/**
 * Best-effort keyword-based category guesser for receipt/bill text. Order matters slightly (first
 * match wins) but categories are specific enough that overlap is rare in practice.
 */
const CATEGORY_KEYWORDS: Partial<Record<ExpenseCategory, string[]>> = {
  FOOD: ["restaurant", "cafe", "food", "swiggy", "zomato", "dine", "kitchen", "eatery", "pizza", "burger", "bakery"],
  FUEL: ["petrol", "diesel", "fuel", "indian oil", "bharat petroleum", "hindustan petroleum", "shell", "hpcl", "bpcl", "iocl"],
  TRAVEL: ["uber", "ola", "irctc", "railway", "airlines", "flight", "cab", "taxi", "makemytrip", "goibibo", "metro"],
  ENTERTAINMENT: ["netflix", "prime video", "hotstar", "bookmyshow", "cinema", "movie", "spotify", "multiplex", "pvr", "inox"],
  MEDICAL: ["pharmacy", "hospital", "clinic", "medical", "apollo", "medplus", "diagnostic", "chemist", "medicine"],
  BILLS: ["electricity", "water bill", "gas bill", "broadband", "internet", "recharge", "postpaid", "dth"],
  EMI: ["emi", "loan installment", "loan instalment"],
  INSURANCE: ["insurance", "premium", "policy no"],
  EDUCATION: ["school", "college", "tuition", "university", "admission fee"],
  SHOPPING: ["mart", "store", "supermarket", "amazon", "flipkart", "myntra", "retail", "mall", "hypermarket"],
};

function guessCategory(text: string): ExpenseCategory | null {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ExpenseCategory, string[]][]) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return null;
}

const AMOUNT_LABEL_PATTERN =
  /(grand\s*total|net\s*amount|amount\s*paid|total\s*amount|total\s*payable|bill\s*amount|net\s*payable|total)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+\.\d{1,2}|[\d,]+)/i;
const GENERIC_AMOUNT_PATTERN = /(?:rs\.?|inr|₹)\s*([\d,]+\.\d{1,2}|[\d,]+)/gi;

function guessAmount(text: string): number | null {
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(AMOUNT_LABEL_PATTERN);
    if (match) {
      const num = parseFloat(match[2].replace(/,/g, ""));
      if (!isNaN(num) && num > 0) return num;
    }
  }

  // Fallback: the largest ₹/Rs./INR-prefixed number anywhere in the text (receipts usually list
  // subtotal/tax/total in ascending order, so the largest is a reasonable guess for the total).
  let best: number | null = null;
  let match: RegExpExecArray | null;
  GENERIC_AMOUNT_PATTERN.lastIndex = 0;
  while ((match = GENERIC_AMOUNT_PATTERN.exec(text))) {
    const num = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(num) && (best === null || num > best)) best = num;
  }
  return best;
}

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(Date.UTC(fullYear, month - 1, day));
  if (date.getUTCFullYear() !== fullYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null; // ignore obviously-future "dates" (OCR noise)
  return date.toISOString().slice(0, 10);
}

function guessDate(text: string): string | null {
  // dd/mm/yyyy or dd-mm-yyyy (assumes Indian day-first convention)
  const numeric = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (numeric) {
    const iso = toIsoDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
    if (iso) return iso;
  }

  // yyyy-mm-dd
  const isoLike = text.match(/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/);
  if (isoLike) {
    const iso = toIsoDate(Number(isoLike[1]), Number(isoLike[2]), Number(isoLike[3]));
    if (iso) return iso;
  }

  // "2 Aug 2026" / "02 August 2026"
  const named = text.match(/\b(\d{1,2})\s+([a-zA-Z]{3,})\s+(\d{2,4})\b/);
  if (named) {
    const monthIndex = MONTH_NAMES.indexOf(named[2].slice(0, 3).toLowerCase());
    if (monthIndex >= 0) {
      const iso = toIsoDate(Number(named[3]), monthIndex + 1, Number(named[1]));
      if (iso) return iso;
    }
  }

  return null;
}

function guessDescription(text: string): string | null {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length >= 3 && l.length <= 60 && !/^\d+$/.test(l));
  return line ?? null;
}

export interface ReceiptScanResult {
  amount: number | null;
  date: string | null;
  category: ExpenseCategory | null;
  description: string | null;
}

/** Best-effort heuristic extraction — always review-before-save, never auto-commits an expense. */
export function parseReceiptText(text: string): ReceiptScanResult {
  return {
    amount: guessAmount(text),
    date: guessDate(text),
    category: guessCategory(text),
    description: guessDescription(text),
  };
}
