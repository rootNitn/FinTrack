/**
 * Static thresholds/labels for the "AI Features" insights module.
 *
 * IMPORTANT: Nothing here calls an external LLM/AI API. All "insights" are deterministic,
 * rule-based computations over the user's own data (spending history, investments, goals,
 * budgets). This keeps the feature fast, free, offline-friendly and fully explainable —
 * clearly NOT financial advice, just pattern-based observations on the user's own numbers.
 */

/** Investment categories treated as "growth-oriented" (equity-like, higher long-term upside). */
export const GROWTH_CATEGORIES = ["STOCKS", "MUTUAL_FUNDS", "CRYPTO"] as const;

/** Investment categories treated as "capital-safe" (low volatility, capital protection). */
export const SAFE_CATEGORIES = ["FIXED_DEPOSIT", "PPF", "EPF", "CASH", "BONDS"] as const;

/** Thresholds used across the rule-based analyses below. */
export const AI_INSIGHTS_THRESHOLDS = {
  /** Number of trailing months (before the current month) used for averages/anomaly detection. */
  trendLookbackMonths: 6,
  /** A category's current-month spend must exceed its trailing average by this factor to be "unusual". */
  unusualSpendMultiplier: 1.3,
  /** Additional check: current spend must also exceed (trailing average + this many trailing std-deviations). */
  unusualSpendStdDevMultiplier: 1.5,
  /** Minimum absolute amount for a spend spike to be worth flagging (avoids noise on tiny categories). */
  unusualSpendMinAmount: 500,
  /** Hypothetical trim used to estimate potential monthly savings per category. */
  suggestedTrimPercent: 0.1,
  /** Idle cash beyond this many months of average expenses is flagged as "put it to work". */
  idleCashMonthsThreshold: 6,
  /** Below this many months of expenses in cash, flag a thin emergency buffer. */
  thinBufferMonthsThreshold: 3,
  /** Recurring-expense share of total monthly spend, above which we suggest a subscription review. */
  recurringShareThreshold: 30,
  /** Budget utilisation percent thresholds. */
  budgetWarningPercent: 80,
  budgetCriticalPercent: 100,
  /** Portfolio concentration in a single asset category, above which we flag concentration risk. */
  concentrationWarningPercent: 50,
  concentrationCriticalPercent: 70,
  /** Share of HIGH risk investments (by value), above which we flag elevated portfolio risk. */
  highRiskSharePercent: 50,
  /** Window (days) for "upcoming maturity" alerts. */
  upcomingMaturityDays: 90,
  /** Average goal horizon (years) boundaries used to infer a risk profile hint. */
  conservativeHorizonYears: 2,
  growthHorizonYears: 5,
} as const;

export type InsightSeverity = "info" | "warning" | "critical";
