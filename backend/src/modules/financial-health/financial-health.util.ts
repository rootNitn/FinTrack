import { ExpenseCategory, InvestmentCategory, RecurrenceInterval } from "@prisma/client";
import { calculateXirr, CashFlow } from "../../utils/xirr.util";
import { computeGoalProgress, computeNetWorth, NetWorthSummary } from "../../utils/finance-calculations.util";

export { computeNetWorth, NetWorthSummary };

export type FinancialHealthStatus = "good" | "warning" | "critical" | "na";

export interface FinancialHealthRule {
  id: string;
  title: string;
  status: FinancialHealthStatus;
  summary: string;
  recommendation: string;
  data: Record<string, number | null>;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

/** RENT/BILLS/EMI/INSURANCE/MEDICAL/EDUCATION/FUEL/FOOD are treated as "needs"; the rest as "wants". */
const NEEDS_CATEGORIES: ExpenseCategory[] = [
  "RENT",
  "BILLS",
  "EMI",
  "INSURANCE",
  "MEDICAL",
  "EDUCATION",
  "FUEL",
  "FOOD",
];

export function isNeedCategory(category: ExpenseCategory): boolean {
  return NEEDS_CATEGORIES.includes(category);
}

/** Same "needs" set doubles as the essential-expenses set used for the Emergency Fund rule. */
export function isEssentialCategory(category: ExpenseCategory): boolean {
  return NEEDS_CATEGORIES.includes(category);
}

const EQUITY_CATEGORIES: InvestmentCategory[] = ["STOCKS", "MUTUAL_FUNDS", "CRYPTO"];
const DEBT_CATEGORIES: InvestmentCategory[] = ["FIXED_DEPOSIT", "PPF", "EPF", "NPS", "BONDS", "CASH"];
const GOLD_CATEGORIES: InvestmentCategory[] = ["GOLD"];

export function classifyAssetBucket(category: InvestmentCategory): "equity" | "debt" | "gold" | "other" {
  if (EQUITY_CATEGORIES.includes(category)) return "equity";
  if (DEBT_CATEGORIES.includes(category)) return "debt";
  if (GOLD_CATEGORIES.includes(category)) return "gold";
  return "other";
}

/**
 * 50/30/20 rule of thumb: Needs / Wants / Savings as a % of monthly income.
 * "Savings" = income minus all tracked expenses (needs + wants), so it also captures
 * any unspent/uncategorized income, not just explicit savings transactions.
 */
export function computeFiftyThirtyTwenty(monthlyIncome: number, needsTotal: number, wantsTotal: number): FinancialHealthRule {
  if (monthlyIncome <= 0) {
    return {
      id: "50-30-20",
      title: "50/30/20 Rule",
      status: "na",
      summary: "No income recorded for this period, so the split can't be calculated.",
      recommendation: "Log your income to see how your spending compares to the 50/30/20 rule of thumb.",
      data: { monthlyIncome: 0, needsPercent: null, wantsPercent: null, savingsPercent: null },
    };
  }

  const savingsTotal = monthlyIncome - needsTotal - wantsTotal;
  const needsPercent = round((needsTotal / monthlyIncome) * 100);
  const wantsPercent = round((wantsTotal / monthlyIncome) * 100);
  const savingsPercent = round((savingsTotal / monthlyIncome) * 100);

  // Only overspending (needs/wants above target) or under-saving (below 20%) counts against
  // you — spending less than the needs/wants guideline just means an even higher savings rate,
  // which the 50/30/20 rule treats as a good outcome, not a violation.
  const needsOverBy = Math.max(0, needsPercent - 50);
  const wantsOverBy = Math.max(0, wantsPercent - 30);
  const savingsUnderBy = Math.max(0, 20 - savingsPercent);
  const worstOff = Math.max(needsOverBy, wantsOverBy, savingsUnderBy);

  const status: FinancialHealthStatus = worstOff <= 5 ? "good" : worstOff <= 15 ? "warning" : "critical";
  const isHighSaver = status === "good" && savingsPercent >= 40;

  return {
    id: "50-30-20",
    title: "50/30/20 Rule",
    status,
    summary: isHighSaver
      ? `Excellent savings rate — you're saving ~${savingsPercent}% of income, well above the 20% guideline (Needs ${needsPercent}% / Wants ${wantsPercent}%).`
      : `Needs ${needsPercent}% / Wants ${wantsPercent}% / Savings ${savingsPercent}% (target 50/30/20).`,
    recommendation:
      status === "good"
        ? isHighSaver
          ? "Your spending is significantly below the 50/30/20 guideline — this rule is a guideline, not a pass/fail test, so a high savings rate is a good thing."
          : "Your spending split is close to the 50/30/20 rule of thumb — keep it up."
        : savingsPercent < 20
          ? "Try trimming discretionary (wants) spending to push savings closer to 20% of income."
          : "Your needs or wants spending is above the 50/30/20 guideline — review recent expense categories.",
    data: { monthlyIncome: round(monthlyIncome), needsPercent, wantsPercent, savingsPercent },
  };
}

/**
 * Emergency Fund rule of thumb: keep 3-6 months of essential expenses in liquid savings
 * (bank balances + active FDs, using FD principal as a conservative stand-in for current value).
 * Coverage = Liquid Assets ÷ Essential Monthly Expenses, scored across 5 tiers:
 * <1 Critical, 1–3 Building, 3–6 Healthy, 6–12 Strong, >12 Review excess cash.
 */
export function computeEmergencyFund(liquidSavings: number, essentialMonthlyExpense: number): FinancialHealthRule {
  if (essentialMonthlyExpense <= 0) {
    return {
      id: "emergency-fund",
      title: "Emergency Fund (3–6 Months)",
      status: "na",
      summary: "No essential expenses recorded for this period, so months-covered can't be calculated.",
      recommendation: "Log rent/bills/EMI/insurance/medical/education/fuel/food expenses to track this rule.",
      data: { liquidSavings: round(liquidSavings), essentialMonthlyExpense: 0, monthsCovered: null },
    };
  }

  const monthsCovered = round(liquidSavings / essentialMonthlyExpense);

  let tier: string;
  let status: FinancialHealthStatus;
  let recommendation: string;
  if (monthsCovered < 1) {
    tier = "Critical";
    status = "critical";
    recommendation = "Build up liquid savings (bank balance/FDs) to cover at least 3 months of essential expenses.";
  } else if (monthsCovered < 3) {
    tier = "Building";
    status = "warning";
    recommendation = "Keep building your buffer — aim for at least 3 months of essential expenses.";
  } else if (monthsCovered < 6) {
    tier = "Healthy";
    status = "good";
    recommendation = "You have a healthy emergency fund buffer.";
  } else if (monthsCovered <= 12) {
    tier = "Strong";
    status = "good";
    recommendation = "You have a strong emergency fund buffer.";
  } else {
    tier = "Review excess cash";
    status = "warning";
    recommendation =
      "You have more than the standard 3–6 month buffer. Consider whether some excess cash should be allocated toward long-term goals.";
  }

  return {
    id: "emergency-fund",
    title: "Emergency Fund (3–6 Months)",
    status,
    summary: `Your liquid savings cover about ${monthsCovered} month(s) of essential expenses (tier: ${tier}).`,
    recommendation,
    data: { liquidSavings: round(liquidSavings), essentialMonthlyExpense: round(essentialMonthlyExpense), monthsCovered },
  };
}


/**
 * Rule of 72/114/144 rule of thumb: approximate doubling/tripling/quadrupling time in years
 * = 72 (or 114, 144) / annual return %. All three share the same portfolio-wide XIRR input.
 */
export function computeRuleOf72(cashFlows: CashFlow[]): FinancialHealthRule {
  const xirrPercent = calculateXirr(cashFlows);

  if (xirrPercent === null || xirrPercent <= 0) {
    return {
      id: "rule-of-72",
      title: "Rule of 72 / 114 / 144",
      status: "na",
      summary: "Not enough investment history to estimate an annualized return yet.",
      recommendation: "Add more investments with purchase dates and current values to estimate doubling time.",
      data: { xirrPercent, doublingYears: null, triplingYears: null, quadruplingYears: null },
    };
  }

  const doublingYears = round(72 / xirrPercent);
  const triplingYears = round(114 / xirrPercent);
  const quadruplingYears = round(144 / xirrPercent);
  const status: FinancialHealthStatus = xirrPercent >= 12 ? "good" : xirrPercent >= 8 ? "warning" : "critical";

  return {
    id: "rule-of-72",
    title: "Rule of 72 / 114 / 144",
    status,
    summary: `At your portfolio's ~${round(xirrPercent)}% annualized return, money roughly doubles in ${doublingYears}y, triples in ${triplingYears}y, and quadruples in ${quadruplingYears}y.`,
    recommendation:
      status === "good"
        ? "Your portfolio return is solid — these are rough approximations, not guarantees."
        : "Higher long-term returns (within your risk tolerance) would shorten these timelines.",
    data: { xirrPercent: round(xirrPercent), doublingYears, triplingYears, quadruplingYears },
  };
}

/**
 * 60/30/10 asset allocation rule of thumb: Equity / Debt / Gold as a % of current investment value.
 * Any "other" category (real estate, uncategorized) is reported separately and excluded from the
 * 3-way percentages so it doesn't distort the equity/debt/gold comparison.
 */
export function computeAssetAllocation(equityValue: number, debtValue: number, goldValue: number, otherValue: number): FinancialHealthRule {
  const total = equityValue + debtValue + goldValue;
  if (total <= 0) {
    return {
      id: "60-30-10",
      title: "60/30/10 Asset Allocation",
      status: "na",
      summary: "No equity/debt/gold investments found to compute an allocation split.",
      recommendation: "Add investments (stocks, mutual funds, FDs, gold, etc.) to see your allocation vs the 60/30/10 rule of thumb.",
      data: { equityPercent: null, debtPercent: null, goldPercent: null, otherValue: round(otherValue) },
    };
  }

  const equityPercent = round((equityValue / total) * 100);
  const debtPercent = round((debtValue / total) * 100);
  const goldPercent = round((goldValue / total) * 100);

  const equityOff = Math.abs(equityPercent - 60);
  const debtOff = Math.abs(debtPercent - 30);
  const goldOff = Math.abs(goldPercent - 10);
  const worstOff = Math.max(equityOff, debtOff, goldOff);

  const status: FinancialHealthStatus = worstOff <= 10 ? "good" : worstOff <= 20 ? "warning" : "critical";

  return {
    id: "60-30-10",
    title: "60/30/10 Asset Allocation",
    status,
    summary: `Equity ${equityPercent}% / Debt ${debtPercent}% / Gold ${goldPercent}% (target 60/30/10).`,
    recommendation:
      status === "good"
        ? "Your allocation is close to the 60/30/10 rule of thumb."
        : "Consider rebalancing toward 60% equity / 30% debt / 10% gold, adjusted for your own risk tolerance and age.",
    data: { equityPercent, debtPercent, goldPercent, otherValue: round(otherValue) },
  };
}

/**
 * 100 − Age rule of thumb: equity allocation ≈ 100 minus your age. A rough starting point,
 * not a universal recommendation — a 30-year-old doesn't have to hold 70% equity.
 */
export function computeAgeBasedAllocation(dateOfBirth: Date | null, equityValue: number, totalInvestmentValue: number): FinancialHealthRule {
  if (!dateOfBirth || totalInvestmentValue <= 0) {
    return {
      id: "hundred-minus-age",
      title: "100 − Age Rule",
      status: "na",
      summary: dateOfBirth ? "No investment value found to compute your equity allocation." : "Add your date of birth to see this rule.",
      recommendation: "Set your date of birth in Settings and add investments to compare against the 100−Age rule of thumb.",
      data: { age: null, targetEquityPercent: null, actualEquityPercent: null },
    };
  }

  const ageMs = Date.now() - dateOfBirth.getTime();
  const age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  const targetEquityPercent = Math.min(100, Math.max(0, 100 - age));
  const actualEquityPercent = round((equityValue / totalInvestmentValue) * 100);

  // A lower-than-guideline equity share is a deliberate, valid risk choice (conservative profile,
  // near-term goals, large upcoming purchase, etc.) — never flag it "critical", only "review".
  const deviation = actualEquityPercent - targetEquityPercent;
  const absDeviation = Math.abs(deviation);
  const status: FinancialHealthStatus = absDeviation <= 10 ? "good" : "warning";
  const riskProfile = deviation < -10 ? "Conservative" : deviation > 10 ? "Aggressive" : "Balanced";

  return {
    id: "hundred-minus-age",
    title: "100 − Age Rule",
    status,
    summary:
      status === "good"
        ? `At age ${age}, the rule of thumb suggests ~${targetEquityPercent}% equity — you currently hold ${actualEquityPercent}%.`
        : `Risk profile: ${riskProfile}. At age ${age}, the guideline suggests ~${targetEquityPercent}% equity — you currently hold ${actualEquityPercent}%.`,
    recommendation:
      status === "good"
        ? "Your equity allocation is close to this age-based guideline."
        : deviation < 0
          ? "Your equity allocation is below the 100−age guideline. This may be appropriate depending on your risk tolerance and goals."
          : "Your equity allocation is above the 100−age guideline. This may be appropriate depending on your risk tolerance and goals.",
    data: { age, targetEquityPercent, actualEquityPercent },
  };
}

/**
 * Save the Raise rule of thumb: invest/save at least 50% of every salary increase.
 * Compares the current month's income/savings against a baseline ~6 months earlier.
 */
export function computeSaveTheRaise(
  currentIncome: number,
  currentSavings: number,
  baselineIncome: number,
  baselineSavings: number,
): FinancialHealthRule {
  const raiseAmount = currentIncome - baselineIncome;

  if (baselineIncome <= 0 || raiseAmount <= 0) {
    return {
      id: "save-the-raise",
      title: "Save the Raise Rule",
      status: "na",
      summary: "No income increase detected over the last ~6 months.",
      recommendation: "When your income goes up, aim to direct at least 50% of the increase into savings/investments.",
      data: { raiseAmount: round(Math.max(raiseAmount, 0)), savedPercentOfRaise: null },
    };
  }

  const savingsIncrease = currentSavings - baselineSavings;
  const savedPercentOfRaise = round(Math.max(0, Math.min(100, (savingsIncrease / raiseAmount) * 100)));
  const status: FinancialHealthStatus = savedPercentOfRaise >= 50 ? "good" : savedPercentOfRaise >= 25 ? "warning" : "critical";

  return {
    id: "save-the-raise",
    title: "Save the Raise Rule",
    status,
    summary: `Your income rose by ~${round(raiseAmount)} and you've directed about ${savedPercentOfRaise}% of that increase into savings (target 50%+).`,
    recommendation:
      status === "good"
        ? "You're saving a healthy share of your raise — keep it up."
        : "Try to direct at least 50% of any future salary increase into savings/investments before lifestyle spending grows.",
    data: { raiseAmount: round(raiseAmount), savedPercentOfRaise },
  };
}

/**
 * Savings Rate Score — Monthly Savings ÷ Monthly Income × 100, scored against app-defined
 * thresholds (not an official financial law, just an in-app scoring scale):
 * <10% Critical, 10–19% Low, 20–29% Good, 30–39% Excellent, 40%+ Exceptional.
 */
export function computeSavingsRateScore(monthlyIncome: number, monthlySavings: number): FinancialHealthRule {
  if (monthlyIncome <= 0) {
    return {
      id: "savings-rate",
      title: "Savings Rate Score",
      status: "na",
      summary: "No income recorded for this period, so the savings rate can't be calculated.",
      recommendation: "Log your income to see your savings rate score.",
      data: { savingsRatePercent: null },
    };
  }

  const savingsRatePercent = round((monthlySavings / monthlyIncome) * 100);

  let tier: string;
  let status: FinancialHealthStatus;
  if (savingsRatePercent < 10) {
    tier = "Critical";
    status = "critical";
  } else if (savingsRatePercent < 20) {
    tier = "Low";
    status = "warning";
  } else if (savingsRatePercent < 30) {
    tier = "Good";
    status = "good";
  } else if (savingsRatePercent < 40) {
    tier = "Excellent";
    status = "good";
  } else {
    tier = "Exceptional";
    status = "good";
  }

  return {
    id: "savings-rate",
    title: "Savings Rate Score",
    status,
    summary: `Your savings rate is ${savingsRatePercent}% of income (tier: ${tier}).`,
    recommendation:
      status === "critical"
        ? "Aim to save at least 10-20% of your income — look for recurring expenses to trim."
        : status === "warning"
          ? "You're saving, but pushing past 20% would put you in the \"Good\" tier."
          : `A ${tier.toLowerCase()} savings rate — keep it up.`,
    data: { savingsRatePercent },
  };
}

/** Net Worth = Total Assets − Total Liabilities, plus month-over-month and year-over-year growth. Informational — not scored. */

/**
 * Goal Funding Ratio (one rule per goal): Current Goal Corpus ÷ Required Corpus × 100.
 * Tiers (app-defined, not an official rule): <25% Critical, 25–49% Underfunded,
 * 50–79% Partially Funded, 80–99% On Track, 100%+ Fully Funded.
 */
export function computeGoalFunding(goal: { id: string; name: string; currentAmount: number; targetAmount: number }): FinancialHealthRule {
  if (goal.targetAmount <= 0) {
    return {
      id: `goal-funding-${goal.id}`,
      title: `Goal: ${goal.name}`,
      status: "na",
      summary: "This goal has no target amount set, so funding can't be calculated.",
      recommendation: "Set a target amount for this goal to track its funding ratio.",
      data: { fundingPercent: null },
    };
  }

  const fundingPercent = round(computeGoalProgress(goal.currentAmount, goal.targetAmount).progressPercent);

  let tier: string;
  let status: FinancialHealthStatus;
  if (fundingPercent >= 100) {
    tier = "Fully Funded";
    status = "good";
  } else if (fundingPercent >= 80) {
    tier = "On Track";
    status = "good";
  } else if (fundingPercent >= 50) {
    tier = "Partially Funded";
    status = "warning";
  } else if (fundingPercent >= 25) {
    tier = "Underfunded";
    status = "warning";
  } else {
    tier = "Critical";
    status = "critical";
  }

  return {
    id: `goal-funding-${goal.id}`,
    title: `Goal: ${goal.name}`,
    status,
    summary: `${fundingPercent}% funded — ${tier} (₹${round(goal.currentAmount)} of ₹${round(goal.targetAmount)}).`,
    recommendation:
      status === "good"
        ? "This goal is well funded — keep contributing on schedule."
        : "Consider increasing contributions toward this goal to stay on track for its deadline.",
    data: { fundingPercent, currentAmount: round(goal.currentAmount), targetAmount: round(goal.targetAmount) },
  };
}

/**
 * Rebalancing Score: compares actual equity/debt/gold allocation against a user-chosen
 * target (defaults to 60/30/10). Suggested rule: <5% difference On Track, 5–10% Review,
 * >10% Rebalancing Needed — an app-defined guide, not an official rule.
 */
export function computeRebalancingScore(
  equityPercent: number,
  debtPercent: number,
  goldPercent: number,
  targetEquityPercent = 60,
  targetDebtPercent = 30,
  targetGoldPercent = 10,
): FinancialHealthRule {
  if (equityPercent + debtPercent + goldPercent <= 0) {
    return {
      id: "rebalancing",
      title: "Rebalancing Score",
      status: "na",
      summary: "No investments found, so asset allocation cannot be evaluated.",
      recommendation: "Add your investments to compare your portfolio with your target allocation.",
      data: {
        targetEquityPercent,
        targetDebtPercent,
        targetGoldPercent,
        equityPercent: null,
        debtPercent: null,
        goldPercent: null,
        equityDiff: null,
        debtDiff: null,
        goldDiff: null,
      },
    };
  }

  const equityDiff = round(equityPercent - targetEquityPercent);
  const debtDiff = round(debtPercent - targetDebtPercent);
  const goldDiff = round(goldPercent - targetGoldPercent);
  const worstOff = Math.max(Math.abs(equityDiff), Math.abs(debtDiff), Math.abs(goldDiff));

  const status: FinancialHealthStatus = worstOff <= 5 ? "good" : worstOff <= 10 ? "warning" : "critical";

  return {
    id: "rebalancing",
    title: "Rebalancing Score",
    status,
    summary:
      status === "good"
        ? `Your allocation is close to your target (${targetEquityPercent}/${targetDebtPercent}/${targetGoldPercent}).`
        : `Your portfolio differs from your target (${targetEquityPercent}/${targetDebtPercent}/${targetGoldPercent}) by up to ${worstOff} points.`,
    recommendation:
      status === "good"
        ? "No rebalancing needed right now."
        : status === "warning"
          ? "Consider reviewing your allocation — it's starting to drift from your target."
          : "Rebalancing needed — your portfolio has drifted significantly from your target allocation.",
    data: {
      targetEquityPercent,
      targetDebtPercent,
      targetGoldPercent,
      equityPercent: round(equityPercent),
      debtPercent: round(debtPercent),
      goldPercent: round(goldPercent),
      equityDiff,
      debtDiff,
      goldDiff,
    },
  };
}

/**
 * Debt Health (Debt-to-Income): Total outstanding debt (credit cards + manual liabilities) ÷
 * Annual Income × 100. An approximation of the classic DTI ratio — this app doesn't track loan
 * amortization schedules, so it compares total debt load against annual income rather than
 * monthly debt-service payments against monthly income. App-defined tiers: <20% Healthy,
 * 20–35% Moderate, >35% High.
 */
export function computeDebtHealth(totalDebt: number, annualIncome: number): FinancialHealthRule {
  if (annualIncome <= 0) {
    return {
      id: "debt-health",
      title: "Debt Health",
      status: "na",
      summary: "No income recorded, so debt-to-income can't be calculated.",
      recommendation: "Log your income to see how your debt load compares to it.",
      data: { totalDebt: round(totalDebt), annualIncome: 0, debtToIncomePercent: null },
    };
  }

  const debtToIncomePercent = round((totalDebt / annualIncome) * 100);
  const status: FinancialHealthStatus = debtToIncomePercent < 20 ? "good" : debtToIncomePercent <= 35 ? "warning" : "critical";

  return {
    id: "debt-health",
    title: "Debt Health",
    status,
    summary: `Your total debt (credit cards + liabilities) is ${debtToIncomePercent}% of your annual income.`,
    recommendation:
      status === "good"
        ? "Your debt load is healthy relative to your income."
        : status === "warning"
          ? "Your debt load is moderate — avoid taking on more high-interest debt."
          : "Your debt-to-income ratio is high. Prioritize paying down high-interest debt first.",
    data: { totalDebt: round(totalDebt), annualIncome: round(annualIncome), debtToIncomePercent },
  };
}

/**
 * Diversification / concentration check: largest single equity holding as a % of total equity
 * value. Suggested rule (app-defined, not a law): >10% Review, >20% High concentration warning.
 */
export function computeDiversification(
  largestHoldingName: string | null,
  largestHoldingValue: number,
  totalEquityValue: number,
): FinancialHealthRule {
  if (totalEquityValue <= 0 || !largestHoldingName) {
    return {
      id: "diversification",
      title: "Diversification",
      status: "na",
      summary: "No equity holdings found, so concentration can't be calculated.",
      recommendation: "Add your stock/mutual fund holdings to check for concentration risk.",
      data: { concentrationPercent: null },
    };
  }

  const concentrationPercent = round((largestHoldingValue / totalEquityValue) * 100);
  const status: FinancialHealthStatus = concentrationPercent <= 10 ? "good" : concentrationPercent <= 20 ? "warning" : "critical";

  return {
    id: "diversification",
    title: "Diversification",
    status,
    summary: `${largestHoldingName} is your largest equity holding at ${concentrationPercent}% of your equity portfolio.`,
    recommendation:
      status === "good"
        ? "Your equity portfolio is reasonably diversified."
        : status === "warning"
          ? `Review your position in ${largestHoldingName} — it's a sizeable share of your equity portfolio.`
          : `High concentration in ${largestHoldingName} — consider diversifying to reduce single-holding risk.`,
    data: { concentrationPercent, largestHoldingValue: round(largestHoldingValue), totalEquityValue: round(totalEquityValue) },
  };
}

/**
 * Shared corpus-readiness calculator, used for both Retirement Readiness and the Financial
 * Independence Ratio — both are "Investable Assets ÷ Required Corpus × 100", just framed
 * differently (retirement age target vs. a general FI target). Tiers mirror Goal Funding:
 * <25% Critical, 25–49% Underfunded, 50–79% Partially Funded, 80–99% On Track, 100%+ Fully Funded.
 */
function computeCorpusReadiness(
  id: string,
  title: string,
  currentCorpus: number,
  requiredCorpus: number,
  narrative: (percent: number, tier: string) => { summary: string; recommendation: string },
): FinancialHealthRule {
  if (requiredCorpus <= 0) {
    return {
      id,
      title,
      status: "na",
      summary: "Not enough data to estimate the required corpus.",
      recommendation: "Log your monthly expenses (and optionally a custom retirement expense in Settings) to calculate this.",
      data: { readinessPercent: null, currentCorpus: round(currentCorpus), requiredCorpus: null },
    };
  }

  const readinessPercent = round((currentCorpus / requiredCorpus) * 100);

  let tier: string;
  let status: FinancialHealthStatus;
  if (readinessPercent >= 100) {
    tier = "Fully Funded";
    status = "good";
  } else if (readinessPercent >= 80) {
    tier = "On Track";
    status = "good";
  } else if (readinessPercent >= 50) {
    tier = "Partially Funded";
    status = "warning";
  } else if (readinessPercent >= 25) {
    tier = "Underfunded";
    status = "warning";
  } else {
    tier = "Critical";
    status = "critical";
  }

  const { summary, recommendation } = narrative(readinessPercent, tier);

  return {
    id,
    title,
    status,
    summary,
    recommendation,
    data: { readinessPercent, currentCorpus: round(currentCorpus), requiredCorpus: round(requiredCorpus) },
  };
}

/**
 * Retirement Readiness: Investable Assets ÷ Required Retirement Corpus × 100, where
 * Required Corpus = Annual Retirement Expense ÷ Withdrawal Rate (user-configurable, default 4%).
 */
export function computeRetirementReadiness(currentCorpus: number, requiredCorpus: number, withdrawalRatePercent: number): FinancialHealthRule {
  return computeCorpusReadiness("retirement-readiness", "Retirement Readiness", currentCorpus, requiredCorpus, (percent, tier) => ({
    summary: `Retirement Readiness: ${percent}% (${tier}) — based on a ${withdrawalRatePercent}% withdrawal rate.`,
    recommendation:
      percent >= 80
        ? "You're on track for retirement at your current pace."
        : "Consider increasing retirement-focused contributions, or adjust your expected withdrawal rate/expenses in Settings.",
  }));
}

/**
 * Financial Independence Ratio: same formula as Retirement Readiness (Investable Assets ÷
 * Required Corpus), framed as "can I stop working today", not just "am I ready to retire".
 */
export function computeFinancialIndependenceRatio(currentCorpus: number, requiredCorpus: number): FinancialHealthRule {
  return computeCorpusReadiness("fi-ratio", "Financial Independence Ratio", currentCorpus, requiredCorpus, (percent) => ({
    summary: `You're approximately ${percent}% of the way toward your estimated financial independence target.`,
    recommendation:
      percent >= 100
        ? "You've reached your estimated financial independence target."
        : "Keep growing your investable assets relative to your required corpus to move closer to financial independence.",
  }));
}

/**
 * Insurance Protection Score: checks health insurance existence/adequacy (₹5L+ sum insured is
 * used as a rough adequacy floor) and, only if the user has dependents (any FamilyMember on
 * file), life insurance existence/adequacy (10× annual income is used as a rough guideline —
 * a planning heuristic, not a universal rule). Overall status is the worse of the two checks;
 * life insurance is skipped entirely (not penalized) if there are no dependents.
 */
export function computeInsuranceScore(
  hasHealthPolicy: boolean,
  healthSumInsured: number,
  hasDependents: boolean,
  hasLifePolicy: boolean,
  lifeSumInsured: number,
  annualIncome: number,
): FinancialHealthRule {
  if (!hasHealthPolicy && !hasLifePolicy) {
    return {
      id: "insurance",
      title: "Insurance Protection Score",
      status: "na",
      summary: "No insurance policies found to evaluate.",
      recommendation: "Add your health or life insurance policies to track your protection level.",
      data: {
        healthSumInsured: null,
        lifeSumInsured: null,
        recommendedLifeCover: annualIncome > 0 ? round(annualIncome * 10) : null,
      },
    };
  }

  const HEALTH_ADEQUATE_FLOOR = 500000;
  const healthStatus: FinancialHealthStatus = !hasHealthPolicy ? "critical" : healthSumInsured >= HEALTH_ADEQUATE_FLOOR ? "good" : "warning";

  let lifeStatus: FinancialHealthStatus = "na";
  const recommendedLifeCover = annualIncome > 0 ? annualIncome * 10 : null;
  if (hasDependents) {
    lifeStatus = !hasLifePolicy ? "critical" : recommendedLifeCover && lifeSumInsured >= recommendedLifeCover ? "good" : "warning";
  }

  const statuses = [healthStatus, lifeStatus].filter((s) => s !== "na") as FinancialHealthStatus[];
  const overall: FinancialHealthStatus = statuses.includes("critical")
    ? "critical"
    : statuses.includes("warning")
      ? "warning"
      : statuses.length > 0
        ? "good"
        : "na";

  const parts: string[] = [];
  parts.push(hasHealthPolicy ? `Health cover: ₹${round(healthSumInsured)}` : "No health insurance on file");
  if (hasDependents) {
    parts.push(hasLifePolicy ? `Life cover: ₹${round(lifeSumInsured)}` : "No life insurance on file");
  }

  return {
    id: "insurance",
    title: "Insurance Protection Score",
    status: overall,
    summary: parts.join(" · "),
    recommendation:
      overall === "good"
        ? "Your insurance coverage looks adequate."
        : !hasHealthPolicy
          ? "Get a health insurance policy — it's the most important protection to have first."
          : healthStatus === "warning"
            ? "Consider increasing your health cover — ₹5L+ is a common adequacy guideline."
            : hasDependents && !hasLifePolicy
              ? "You have dependents but no life insurance on file — consider a term life policy (a common guideline is ~10-15x annual income)."
              : "Consider increasing your life cover to better protect your dependents.",
    data: {
      healthSumInsured: hasHealthPolicy ? round(healthSumInsured) : null,
      lifeSumInsured: hasLifePolicy ? round(lifeSumInsured) : null,
      recommendedLifeCover: recommendedLifeCover !== null ? round(recommendedLifeCover) : null,
    },
  };
}

/**
 * Tax Efficiency Score: reuses the user's most recently SAVED tax calculation (Tax module) to
 * check whether they're on the cheaper regime. Doesn't recompute tax here — that's the tax
 * module's job. Returns "na" if the user hasn't saved a calculation yet.
 */
export function computeTaxEfficiency(
  hasSavedCalculation: boolean,
  selectedRegime: "OLD" | "NEW" | null,
  recommendedRegime: "OLD" | "NEW" | null,
  taxSaved: number,
  cheaperRegimeTax: number,
): FinancialHealthRule {
  if (!hasSavedCalculation || !recommendedRegime) {
    return {
      id: "tax-efficiency",
      title: "Tax Efficiency Score",
      status: "na",
      summary: "No saved tax calculation found.",
      recommendation: "Run a calculation in the Tax Planner and save it to see your Tax Efficiency Score.",
      data: { taxSaved: null, savingsPercent: null },
    };
  }

  // Percent saved relative to what the OTHER (more expensive) regime would have cost — not the
  // cheaper regime's own tax. Using cheaperRegimeTax as the denominator breaks down to a
  // misleading 0% whenever the cheaper regime's tax happens to be ₹0 (e.g. fully covered by the
  // rebate) even though real rupees were saved. Bug found via manual UI check, 2026-08-10.
  const otherRegimeTax = cheaperRegimeTax + taxSaved;
  const savingsPercent = otherRegimeTax > 0 ? round((taxSaved / otherRegimeTax) * 100) : 0;
  const onRecommendedRegime = selectedRegime === recommendedRegime;
  const status: FinancialHealthStatus = onRecommendedRegime || taxSaved <= 0 ? "good" : savingsPercent <= 10 ? "warning" : "critical";

  // This is a pointer to the Tax module's own regime comparison, not a second tax engine — it
  // only reads the most recently saved TaxCalculation and never recomputes (feature overlap audit, 2026-08-10).
  return {
    id: "tax-efficiency",
    title: "Tax Efficiency Score",
    status,
    summary: onRecommendedRegime
      ? `Your last saved Tax Calculator result (${recommendedRegime} regime) is already your cheaper option.`
      : `Your last saved Tax Calculator result shows the ${recommendedRegime} regime could save you ~₹${round(taxSaved)}.`,
    recommendation:
      status === "good"
        ? "Reusing your last saved Tax Calculator result — no action needed here."
        : "Tax-saving opportunity identified in your last saved calculation — recompute and confirm in the Tax Planner before filing.",
    data: { taxSaved: round(taxSaved), savingsPercent },
  };
}

/**
 * Expected number of recurring-investment installments between purchaseDate and
 * min(now, recurrenceEndDate ?? now), given the recurrence interval.
 */
export function computeExpectedInstallments(
  purchaseDate: Date,
  recurrenceEndDate: Date | null,
  interval: RecurrenceInterval,
  now: Date,
): number {
  const end = recurrenceEndDate && recurrenceEndDate < now ? recurrenceEndDate : now;
  const elapsedMs = end.getTime() - purchaseDate.getTime();
  if (elapsedMs <= 0) return 1;

  const dayMs = 1000 * 60 * 60 * 24;
  if (interval === "WEEKLY") return Math.max(1, Math.floor(elapsedMs / (dayMs * 7)) + 1);
  if (interval === "YEARLY") return Math.max(1, Math.floor(elapsedMs / (dayMs * 365)) + 1);
  return Math.max(1, Math.floor(elapsedMs / (dayMs * 30)) + 1); // MONTHLY
}

/**
 * Investment Discipline (SIP consistency): actual recurring-investment installments made ÷
 * expected installments (based on interval + elapsed time), aggregated across all recurring
 * investments. Tiers: >95% Excellent, 90–95% Good, 75–90% Fair, <75% Poor.
 */
export function computeInvestmentDiscipline(actualInstallments: number, expectedInstallments: number): FinancialHealthRule {
  if (expectedInstallments <= 0) {
    return {
      id: "investment-discipline",
      title: "Investment Discipline",
      status: "na",
      summary: "No recurring (SIP-style) investments found.",
      recommendation: "Set up a recurring investment to track SIP consistency.",
      data: { consistencyPercent: null },
    };
  }

  const consistencyPercent = round(Math.min(100, (actualInstallments / expectedInstallments) * 100));

  let tier: string;
  let status: FinancialHealthStatus;
  if (consistencyPercent > 95) {
    tier = "Excellent";
    status = "good";
  } else if (consistencyPercent >= 90) {
    tier = "Good";
    status = "good";
  } else if (consistencyPercent >= 75) {
    tier = "Fair";
    status = "warning";
  } else {
    tier = "Poor";
    status = "critical";
  }

  return {
    id: "investment-discipline",
    title: "Investment Discipline",
    status,
    summary: `SIP consistency: ${consistencyPercent}% (${actualInstallments} of ${expectedInstallments} expected installments) — ${tier}.`,
    recommendation:
      status === "good"
        ? "Great SIP consistency — keep it up."
        : "You've missed some scheduled SIP installments — try automating payments to stay consistent.",
    data: { consistencyPercent, actualInstallments, expectedInstallments },
  };
}

