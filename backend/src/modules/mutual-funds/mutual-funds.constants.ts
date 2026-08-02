import { InvestmentInstrumentType } from "../investment-comparison/investment-comparison.constants";

/** A fund's XIRR within this many percentage points of its benchmark is considered "in line" rather than out/under-performing. */
export const RATING_BAND_PERCENT = 2;

/** Fixed absolute-return thresholds used when a fund's category can't be mapped to a live benchmark. */
export const ABSOLUTE_RATING_THRESHOLDS = { GOOD: 12, AVERAGE: 6 };

interface CategoryMapping {
  /** Lowercase substrings matched against the AMFI `scheme_category` string (mfapi.in). */
  keywords: string[];
  benchmark: InvestmentInstrumentType;
  label: string;
}

/**
 * Maps a raw AMFI scheme category (e.g. "Equity Scheme - Large Cap Fund") to one of the live
 * benchmark CAGR sources already tracked by the Investment Comparison module
 * (`investment-comparison/live-return.service.ts`), so the Mutual Funds dashboard can rate each
 * fund against a relevant market benchmark without any new external data source. Order matters —
 * more specific keywords are checked first.
 */
const MF_CATEGORY_MAPPINGS: CategoryMapping[] = [
  { keywords: ["large cap"], benchmark: "LARGE_CAP_FUND", label: "Large Cap" },
  { keywords: ["mid cap"], benchmark: "MID_CAP_FUND", label: "Mid Cap" },
  { keywords: ["small cap"], benchmark: "SMALL_CAP_FUND", label: "Small Cap" },
  { keywords: ["liquid"], benchmark: "LIQUID_FUND", label: "Liquid" },
  {
    keywords: ["debt", "bond", "banking and psu", "gilt", "corporate bond", "income"],
    benchmark: "DEBT_MUTUAL_FUND",
    label: "Debt",
  },
];

export interface CategoryBenchmarkMapping {
  benchmark: InvestmentInstrumentType;
  label: string;
}

/** Returns the matched benchmark + a display label for a raw scheme category, or `null` if unmapped (e.g. hybrid/index/ELSS funds). */
export function mapSchemeCategoryToBenchmark(schemeCategory: string | null | undefined): CategoryBenchmarkMapping | null {
  if (!schemeCategory) return null;
  const lower = schemeCategory.toLowerCase();
  for (const mapping of MF_CATEGORY_MAPPINGS) {
    if (mapping.keywords.some((keyword) => lower.includes(keyword))) {
      return { benchmark: mapping.benchmark, label: mapping.label };
    }
  }
  return null;
}
