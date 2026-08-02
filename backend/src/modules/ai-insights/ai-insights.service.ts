import { prisma } from "../../config/prisma";
import { GROWTH_CATEGORIES, SAFE_CATEGORIES, AI_INSIGHTS_THRESHOLDS, InsightSeverity } from "./ai-insights.constants";
import { round2, buildMonthBuckets, monthsBetween, percentChange, average, standardDeviation } from "./ai-insights.util";
import { getLiveCagrRates, LiveCagrResult } from "../investment-comparison/live-return.service";
import { InvestmentInstrumentType } from "../investment-comparison/investment-comparison.constants";

const T = AI_INSIGHTS_THRESHOLDS;

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

export interface SpendingCategoryTrend {
  category: string;
  currentMonthAmount: number;
  previousMonthAmount: number;
  changePercent: number | null;
  isUnusual: boolean;
  actionLink?: string;
}

export interface SpendingAnalysis {
  currentMonthTotal: number;
  previousMonthTotal: number;
  changePercent: number | null;
  topCategories: SpendingCategoryTrend[];
  unusualCategories: SpendingCategoryTrend[];
  insights: string[];
}

export interface AssetAllocationSlice {
  category: string;
  value: number;
  percent: number;
}

export interface InvestmentSuggestion {
  title: string;
  message: string;
  severity: InsightSeverity;
  actionLink?: string;
}

export interface InvestmentSuggestions {
  currentAllocation: AssetAllocationSlice[];
  totalValue: number;
  growthPercent: number;
  safePercent: number;
  averageGoalHorizonYears: number | null;
  riskProfileHint: "CONSERVATIVE" | "BALANCED" | "GROWTH" | "UNKNOWN";
  suggestions: InvestmentSuggestion[];
}

export interface MonthlyFinancialSummary {
  month: number;
  year: number;
  income: number;
  expenses: number;
  savings: number;
  savingsRatePercent: number;
  investmentValue: number;
  netWorth: number;
  profit: number;
  previousMonth: { income: number; expenses: number; savings: number };
  incomeChangePercent: number | null;
  expenseChangePercent: number | null;
  savingsChangePercent: number | null;
}

export interface SavingsOpportunity {
  title: string;
  message: string;
  potentialMonthlySavings?: number;
  severity: InsightSeverity;
  actionLink?: string;
}

export interface SavingsOpportunities {
  opportunities: SavingsOpportunity[];
  idleCash: number;
  averageMonthlyExpenses: number;
  recurringSharePercent: number;
}

export interface BudgetAlert {
  category: string | null;
  budgetAmount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  severity: InsightSeverity;
  message: string;
  actionLink?: string;
}

export interface BudgetAlerts {
  alerts: BudgetAlert[];
  hasBudgets: boolean;
  unbudgetedCategories: { category: string; spent: number }[];
}

export interface GoalRecommendation {
  goalId: string;
  name: string;
  type: string;
  progressPercent: number;
  remainingAmount: number;
  monthsRemaining: number | null;
  requiredMonthlyContribution: number | null;
  status: "ACHIEVED" | "ON_TRACK" | "AT_RISK" | "BEHIND" | "OVERDUE";
  message: string;
  actionLink?: string;
}

export interface GoalRecommendations {
  recommendations: GoalRecommendation[];
  averageMonthlySavings: number;
}

export interface PortfolioInsights {
  totalValue: number;
  totalInvested: number;
  totalProfit: number;
  roiPercent: number;
  riskDistribution: { riskLevel: string; value: number; percent: number }[];
  concentration: { category: string; percent: number } | null;
  upcomingMaturities: { id: string; name: string; maturityDate: string; currentValue: number }[];
  insights: string[];
}

export interface AiInsightsResult {
  generatedAt: string;
  spendingAnalysis: SpendingAnalysis;
  investmentSuggestions: InvestmentSuggestions;
  monthlySummary: MonthlyFinancialSummary;
  savingsOpportunities: SavingsOpportunities;
  budgetAlerts: BudgetAlerts;
  goalRecommendations: GoalRecommendations;
  portfolioInsights: PortfolioInsights;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const aiInsightsService = {
  async getInsights(userId: string): Promise<AiInsightsResult> {
    const now = new Date();
    const buckets = buildMonthBuckets(T.trendLookbackMonths + 1, now); // oldest -> newest, last entry is current month
    const earliest = buckets[0].from;

    const [expenses, incomes, investments, goals, bankAccounts, budgets, liveCagrRates] = await Promise.all([
      prisma.expense.findMany({ where: { userId, date: { gte: earliest } } }),
      prisma.income.findMany({ where: { userId, date: { gte: earliest } } }),
      prisma.investment.findMany({ where: { userId } }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.bankAccount.findMany({ where: { userId } }),
      prisma.budget.findMany({ where: { userId, month: buckets[buckets.length - 1].month, year: buckets[buckets.length - 1].year } }),
      getLiveCagrRates().catch(() => ({} as Partial<Record<InvestmentInstrumentType, LiveCagrResult>>)),
    ]);

    // Bucket expenses/income by month key, and expenses further by category within each month.
    const expenseTotalsByMonth = new Map<string, number>();
    const expenseByMonthCategory = new Map<string, Map<string, number>>();
    const recurringByMonth = new Map<string, number>();
    buckets.forEach((b) => {
      expenseTotalsByMonth.set(b.key, 0);
      expenseByMonthCategory.set(b.key, new Map());
      recurringByMonth.set(b.key, 0);
    });
    const bucketKeyForDate = (date: Date): string | undefined => buckets.find((b) => date >= b.from && date <= b.to)?.key;

    expenses.forEach((e) => {
      const key = bucketKeyForDate(e.date);
      if (!key) return;
      const amount = Number(e.amount);
      expenseTotalsByMonth.set(key, (expenseTotalsByMonth.get(key) ?? 0) + amount);
      const byCategory = expenseByMonthCategory.get(key)!;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amount);
      if (e.isRecurring) recurringByMonth.set(key, (recurringByMonth.get(key) ?? 0) + amount);
    });

    const incomeTotalsByMonth = new Map<string, number>();
    buckets.forEach((b) => incomeTotalsByMonth.set(b.key, 0));
    incomes.forEach((inc) => {
      const key = bucketKeyForDate(inc.date);
      if (!key) return;
      incomeTotalsByMonth.set(key, (incomeTotalsByMonth.get(key) ?? 0) + Number(inc.amount));
    });

    const currentBucket = buckets[buckets.length - 1];
    const previousBucket = buckets[buckets.length - 2];
    const priorBuckets = buckets.slice(0, buckets.length - 1); // everything before current month

    const cashAvailable = bankAccounts.reduce((sum, b) => sum + Number(b.balance), 0);

    const spendingAnalysis = buildSpendingAnalysis(buckets, expenseByMonthCategory, expenseTotalsByMonth, currentBucket, previousBucket);
    const investmentSuggestions = buildInvestmentSuggestions(investments, goals, now, liveCagrRates);
    const monthlySummary = buildMonthlySummary(currentBucket, previousBucket, incomeTotalsByMonth, expenseTotalsByMonth, investments, cashAvailable);
    const savingsOpportunities = buildSavingsOpportunities(
      priorBuckets,
      expenseByMonthCategory,
      expenseTotalsByMonth,
      recurringByMonth,
      currentBucket,
      cashAvailable,
      goals
    );
    const budgetAlerts = buildBudgetAlerts(budgets, expenseByMonthCategory.get(currentBucket.key)!, expenseTotalsByMonth.get(currentBucket.key) ?? 0);
    const averageMonthlySavings = average(
      priorBuckets.map((b) => (incomeTotalsByMonth.get(b.key) ?? 0) - (expenseTotalsByMonth.get(b.key) ?? 0))
    );
    const goalRecommendations = buildGoalRecommendations(goals, averageMonthlySavings, now);
    const portfolioInsights = buildPortfolioInsights(investments, now);

    return {
      generatedAt: now.toISOString(),
      spendingAnalysis,
      investmentSuggestions,
      monthlySummary,
      savingsOpportunities,
      budgetAlerts,
      goalRecommendations,
      portfolioInsights,
    };
  },
};

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildSpendingAnalysis(
  buckets: ReturnType<typeof buildMonthBuckets>,
  expenseByMonthCategory: Map<string, Map<string, number>>,
  expenseTotalsByMonth: Map<string, number>,
  currentBucket: ReturnType<typeof buildMonthBuckets>[number],
  previousBucket: ReturnType<typeof buildMonthBuckets>[number]
): SpendingAnalysis {
  const currentCategories = expenseByMonthCategory.get(currentBucket.key)!;
  const previousCategories = expenseByMonthCategory.get(previousBucket.key)!;
  const trailingBuckets = buckets.slice(0, buckets.length - 1); // all months before current, for averages

  const allCategories = new Set<string>();
  expenseByMonthCategory.forEach((map) => map.forEach((_v, cat) => allCategories.add(cat)));

  const trends: SpendingCategoryTrend[] = Array.from(allCategories).map((category) => {
    const currentAmount = round2(currentCategories.get(category) ?? 0);
    const previousAmount = round2(previousCategories.get(category) ?? 0);
    const trailingValues = trailingBuckets.map((b) => expenseByMonthCategory.get(b.key)!.get(category) ?? 0);
    const trailingAvg = average(trailingValues);
    const trailingStdDev = standardDeviation(trailingValues);
    // Flagged as unusual if it clears the minimum-amount floor AND exceeds the higher of two bounds:
    // a flat multiplier of the trailing average, or (average + N std-deviations). Taking the higher
    // bound means naturally volatile categories need a genuinely large spike to be flagged, while
    // stable categories still get flagged for smaller — but still meaningful — increases.
    const stdDevBound = trailingAvg + T.unusualSpendStdDevMultiplier * trailingStdDev;
    const multiplierBound = trailingAvg * T.unusualSpendMultiplier;
    const unusualThreshold = Math.max(stdDevBound, multiplierBound);
    const isUnusual =
      currentAmount >= T.unusualSpendMinAmount &&
      ((trailingAvg > 0 && currentAmount > unusualThreshold) || (trailingAvg === 0 && currentAmount >= T.unusualSpendMinAmount * 2));

    return {
      category,
      currentMonthAmount: currentAmount,
      previousMonthAmount: previousAmount,
      changePercent: percentChange(currentAmount, previousAmount),
      isUnusual,
      actionLink: isUnusual ? "/expenses" : undefined,
    };
  });

  const currentMonthTotal = round2(expenseTotalsByMonth.get(currentBucket.key) ?? 0);
  const previousMonthTotal = round2(expenseTotalsByMonth.get(previousBucket.key) ?? 0);

  const topCategories = [...trends]
    .filter((t) => t.currentMonthAmount > 0)
    .sort((a, b) => b.currentMonthAmount - a.currentMonthAmount)
    .slice(0, 5);
  const unusualCategories = trends.filter((t) => t.isUnusual).sort((a, b) => b.currentMonthAmount - a.currentMonthAmount);

  const insights: string[] = [];
  const overallChange = percentChange(currentMonthTotal, previousMonthTotal);
  if (overallChange !== null) {
    if (overallChange > 10) insights.push(`Your total spending is up ${overallChange.toFixed(1)}% compared to last month.`);
    else if (overallChange < -10) insights.push(`Your total spending is down ${Math.abs(overallChange).toFixed(1)}% compared to last month — nice work.`);
  }
  unusualCategories.slice(0, 3).forEach((t) => {
    insights.push(`Spending on ${t.category} (₹${t.currentMonthAmount.toLocaleString("en-IN")}) is well above your recent average — worth a look.`);
  });
  if (topCategories.length > 0) {
    insights.push(`Your top spending category this month is ${topCategories[0].category} at ₹${topCategories[0].currentMonthAmount.toLocaleString("en-IN")}.`);
  }
  if (insights.length === 0) insights.push("No unusual spending patterns detected this month.");

  return { currentMonthTotal, previousMonthTotal, changePercent: overallChange, topCategories, unusualCategories, insights };
}

function buildInvestmentSuggestions(
  investments: Array<{ category: string; currentValue: unknown }>,
  goals: Array<{ deadline: Date }>,
  now: Date,
  liveCagrRates: Partial<Record<InvestmentInstrumentType, LiveCagrResult>> = {}
): InvestmentSuggestions {
  const byCategory = new Map<string, number>();
  let totalValue = 0;
  investments.forEach((inv) => {
    const value = Number(inv.currentValue);
    totalValue += value;
    byCategory.set(inv.category, (byCategory.get(inv.category) ?? 0) + value);
  });

  const currentAllocation: AssetAllocationSlice[] = Array.from(byCategory.entries())
    .map(([category, value]) => ({ category, value: round2(value), percent: totalValue > 0 ? round2((value / totalValue) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);

  const growthValue = currentAllocation.filter((a) => (GROWTH_CATEGORIES as readonly string[]).includes(a.category)).reduce((s, a) => s + a.value, 0);
  const safeValue = currentAllocation.filter((a) => (SAFE_CATEGORIES as readonly string[]).includes(a.category)).reduce((s, a) => s + a.value, 0);
  const growthPercent = totalValue > 0 ? round2((growthValue / totalValue) * 100) : 0;
  const safePercent = totalValue > 0 ? round2((safeValue / totalValue) * 100) : 0;

  const futureGoals = goals.filter((g) => g.deadline > now);
  const averageGoalHorizonYears =
    futureGoals.length > 0 ? round2(average(futureGoals.map((g) => (g.deadline.getTime() - now.getTime()) / (365 * 24 * 3600 * 1000)))) : null;

  let riskProfileHint: InvestmentSuggestions["riskProfileHint"] = "UNKNOWN";
  if (averageGoalHorizonYears !== null) {
    if (averageGoalHorizonYears < T.conservativeHorizonYears) riskProfileHint = "CONSERVATIVE";
    else if (averageGoalHorizonYears > T.growthHorizonYears) riskProfileHint = "GROWTH";
    else riskProfileHint = "BALANCED";
  }

  const suggestions: InvestmentSuggestion[] = [];
  if (totalValue === 0) {
    suggestions.push({
      title: "Start building your portfolio",
      message: "You haven't recorded any investments yet. Consider starting with an emergency fund in a Liquid Fund or Fixed Deposit before exploring market-linked options.",
      severity: "info",
    });
  } else {
    if (riskProfileHint === "GROWTH" && growthPercent < 40) {
      suggestions.push({
        title: "Consider more growth exposure",
        message: `Your goals have a long average horizon (~${averageGoalHorizonYears} years) but only ${growthPercent}% of your portfolio is in growth-oriented instruments (stocks/mutual funds). Long horizons can typically absorb more equity-linked risk for potentially higher returns.`,
        severity: "info",
      });
    }
    if (riskProfileHint === "CONSERVATIVE" && growthPercent > 50) {
      suggestions.push({
        title: "Reduce short-term market risk",
        message: `Your goals are near-term (~${averageGoalHorizonYears} years) but ${growthPercent}% of your portfolio is in growth/market-linked instruments. Consider shifting a portion into safer options like Fixed Deposits or Liquid Funds to protect capital close to your deadline.`,
        severity: "warning",
      });
    }
    const cryptoPercent = currentAllocation.find((a) => a.category === "CRYPTO")?.percent ?? 0;
    if (cryptoPercent > 20) {
      suggestions.push({
        title: "High crypto exposure",
        message: `${cryptoPercent}% of your portfolio is in Crypto, a highly volatile asset class. Ensure this matches your risk tolerance.`,
        severity: "warning",
      });
    }
    if (safePercent > 80 && riskProfileHint !== "CONSERVATIVE") {
      suggestions.push({
        title: "Portfolio may be overly conservative",
        message: `${safePercent}% of your portfolio is in capital-safe instruments. If your goals allow for it, a modest allocation to growth instruments could improve long-term returns.`,
        severity: "info",
        actionLink: "/investments",
      });
    }

    const nifty50 = liveCagrRates.NIFTY_50_INDEX_FUND;
    if (nifty50 && safePercent > 60) {
      suggestions.push({
        title: "Live market comparison",
        message: `The Nifty 50 index has delivered a live trailing ${nifty50.years.toFixed(1)}-year CAGR of ${round2(nifty50.percent)}%. With ${safePercent}% of your portfolio in capital-safe instruments, it may be worth comparing this against your current returns for any long-horizon goals.`,
        severity: "info",
        actionLink: "/investment-comparison",
      });
    }
  }

  return { currentAllocation, totalValue: round2(totalValue), growthPercent, safePercent, averageGoalHorizonYears, riskProfileHint, suggestions };
}

function buildMonthlySummary(
  currentBucket: ReturnType<typeof buildMonthBuckets>[number],
  previousBucket: ReturnType<typeof buildMonthBuckets>[number],
  incomeTotalsByMonth: Map<string, number>,
  expenseTotalsByMonth: Map<string, number>,
  investments: Array<{ currentValue: unknown; principalAmount: unknown }>,
  cashAvailable: number
): MonthlyFinancialSummary {
  const income = round2(incomeTotalsByMonth.get(currentBucket.key) ?? 0);
  const expensesTotal = round2(expenseTotalsByMonth.get(currentBucket.key) ?? 0);
  const prevIncome = round2(incomeTotalsByMonth.get(previousBucket.key) ?? 0);
  const prevExpenses = round2(expenseTotalsByMonth.get(previousBucket.key) ?? 0);

  const savings = round2(income - expensesTotal);
  const prevSavings = round2(prevIncome - prevExpenses);
  const savingsRatePercent = income > 0 ? round2((savings / income) * 100) : 0;

  const investmentValue = round2(investments.reduce((s, i) => s + Number(i.currentValue), 0));
  const invested = round2(investments.reduce((s, i) => s + Number(i.principalAmount), 0));
  const profit = round2(investmentValue - invested);
  const netWorth = round2(investmentValue + cashAvailable);

  return {
    month: currentBucket.month,
    year: currentBucket.year,
    income,
    expenses: expensesTotal,
    savings,
    savingsRatePercent,
    investmentValue,
    netWorth,
    profit,
    previousMonth: { income: prevIncome, expenses: prevExpenses, savings: prevSavings },
    incomeChangePercent: percentChange(income, prevIncome),
    expenseChangePercent: percentChange(expensesTotal, prevExpenses),
    savingsChangePercent: percentChange(savings, prevSavings),
  };
}

function buildSavingsOpportunities(
  priorBuckets: ReturnType<typeof buildMonthBuckets>,
  expenseByMonthCategory: Map<string, Map<string, number>>,
  expenseTotalsByMonth: Map<string, number>,
  recurringByMonth: Map<string, number>,
  currentBucket: ReturnType<typeof buildMonthBuckets>[number],
  cashAvailable: number,
  goals: Array<{ type: string }>
): SavingsOpportunities {
  const referenceBuckets = priorBuckets.length > 0 ? priorBuckets : [currentBucket];
  const averageMonthlyExpenses = round2(average(referenceBuckets.map((b) => expenseTotalsByMonth.get(b.key) ?? 0)));

  const categoryAverages = new Map<string, number>();
  const allCategories = new Set<string>();
  referenceBuckets.forEach((b) => expenseByMonthCategory.get(b.key)!.forEach((_v, cat) => allCategories.add(cat)));
  allCategories.forEach((cat) => {
    categoryAverages.set(cat, average(referenceBuckets.map((b) => expenseByMonthCategory.get(b.key)!.get(cat) ?? 0)));
  });

  const opportunities: SavingsOpportunity[] = [];

  Array.from(categoryAverages.entries())
    .filter(([, avg]) => avg > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([category, avg]) => {
      const potential = round2(avg * T.suggestedTrimPercent);
      if (potential <= 0) return;
      opportunities.push({
        title: `Trim ${category} spend`,
        message: `You spend an average of ₹${round2(avg).toLocaleString("en-IN")}/month on ${category}. Cutting just ${T.suggestedTrimPercent * 100}% could save you ₹${potential.toLocaleString("en-IN")}/month.`,
        potentialMonthlySavings: potential,
        severity: "info",
        actionLink: "/expenses",
      });
    });

  if (averageMonthlyExpenses > 0 && cashAvailable > averageMonthlyExpenses * T.idleCashMonthsThreshold) {
    opportunities.push({
      title: "Idle cash sitting in bank accounts",
      message: `You have ₹${round2(cashAvailable).toLocaleString("en-IN")} in bank accounts — more than ${T.idleCashMonthsThreshold} months of expenses. Consider moving the surplus into Liquid Funds, FDs, or other instruments to earn better returns.`,
      severity: "info",
      actionLink: "/investment-comparison",
    });
  }

  const hasEmergencyGoal = goals.some((g) => g.type === "EMERGENCY_FUND");
  if (!hasEmergencyGoal && averageMonthlyExpenses > 0 && cashAvailable < averageMonthlyExpenses * T.thinBufferMonthsThreshold) {
    opportunities.push({
      title: "Thin emergency buffer",
      message: `Your available cash covers less than ${T.thinBufferMonthsThreshold} months of expenses and you don't have an Emergency Fund goal set up. Consider building one before pursuing other financial goals.`,
      severity: "warning",
      actionLink: "/goals",
    });
  }

  const currentTotal = expenseTotalsByMonth.get(currentBucket.key) ?? 0;
  const currentRecurring = recurringByMonth.get(currentBucket.key) ?? 0;
  const recurringSharePercent = currentTotal > 0 ? round2((currentRecurring / currentTotal) * 100) : 0;
  if (recurringSharePercent > T.recurringShareThreshold) {
    opportunities.push({
      title: "Review recurring expenses",
      message: `Recurring expenses make up ${recurringSharePercent}% of this month's spend. Review subscriptions and EMIs periodically to cancel anything you no longer need.`,
      severity: "info",
      actionLink: "/expenses",
    });
  }

  if (opportunities.length === 0) {
    opportunities.push({ title: "No immediate opportunities found", message: "Your spending and cash levels look reasonable based on your recent history.", severity: "info" });
  }

  return { opportunities, idleCash: round2(cashAvailable), averageMonthlyExpenses, recurringSharePercent };
}

function buildBudgetAlerts(
  budgets: Array<{ category: string | null; amount: unknown }>,
  currentCategories: Map<string, number>,
  currentTotal: number
): BudgetAlerts {
  const alerts: BudgetAlert[] = budgets
    .map((b) => {
      const amount = Number(b.amount);
      const spent = b.category ? currentCategories.get(b.category) ?? 0 : currentTotal;
      const percentUsed = amount > 0 ? round2(Math.min(999, (spent / amount) * 100)) : 0;
      let severity: InsightSeverity = "info";
      let message = `You've used ${percentUsed}% of your ${b.category ?? "overall"} budget this month.`;
      if (percentUsed >= T.budgetCriticalPercent) {
        severity = "critical";
        message = `You've exceeded your ${b.category ?? "overall"} budget (${percentUsed}% used).`;
      } else if (percentUsed >= T.budgetWarningPercent) {
        severity = "warning";
        message = `You're close to your ${b.category ?? "overall"} budget limit (${percentUsed}% used).`;
      }
      return { category: b.category, budgetAmount: round2(amount), spent: round2(spent), remaining: round2(amount - spent), percentUsed, severity, message, actionLink: "/expenses" };
    })
    .sort((a, b) => b.percentUsed - a.percentUsed);

  const budgetedCategories = new Set(budgets.map((b) => b.category).filter((c): c is string => Boolean(c)));
  const unbudgetedCategories = Array.from(currentCategories.entries())
    .filter(([cat, spent]) => !budgetedCategories.has(cat) && spent > 0)
    .map(([category, spent]) => ({ category, spent: round2(spent) }))
    .sort((a, b) => b.spent - a.spent);

  return { alerts, hasBudgets: budgets.length > 0, unbudgetedCategories };
}

function buildGoalRecommendations(
  goals: Array<{ id: string; name: string; type: string; targetAmount: unknown; currentAmount: unknown; deadline: Date }>,
  averageMonthlySavings: number,
  now: Date
): GoalRecommendations {
  const recommendations: GoalRecommendation[] = goals.map((g) => {
    const target = Number(g.targetAmount);
    const current = Number(g.currentAmount);
    const progressPercent = target > 0 ? round2(Math.min(100, (current / target) * 100)) : 0;
    const remainingAmount = round2(Math.max(0, target - current));

    if (remainingAmount <= 0) {
      return {
        goalId: g.id,
        name: g.name,
        type: g.type,
        progressPercent,
        remainingAmount,
        monthsRemaining: null,
        requiredMonthlyContribution: null,
        status: "ACHIEVED",
        message: `You've reached this goal — great job!`,
        actionLink: "/goals",
      };
    }

    if (g.deadline <= now) {
      return {
        goalId: g.id,
        name: g.name,
        type: g.type,
        progressPercent,
        remainingAmount,
        monthsRemaining: 0,
        requiredMonthlyContribution: null,
        status: "OVERDUE",
        message: `This goal's deadline has passed with ₹${remainingAmount.toLocaleString("en-IN")} still remaining. Consider revising the deadline or target.`,
        actionLink: "/goals",
      };
    }

    const monthsRemaining = Math.max(1, monthsBetween(now, g.deadline));
    const requiredMonthlyContribution = round2(remainingAmount / monthsRemaining);

    let status: GoalRecommendation["status"] = "ON_TRACK";
    let message = `Contribute ~₹${requiredMonthlyContribution.toLocaleString("en-IN")}/month for ${monthsRemaining} months to reach this goal by its deadline.`;
    if (averageMonthlySavings > 0) {
      if (requiredMonthlyContribution > averageMonthlySavings) {
        status = "BEHIND";
        message += ` This exceeds your average monthly savings of ₹${round2(averageMonthlySavings).toLocaleString("en-IN")} — consider extending the deadline or increasing savings.`;
      } else if (requiredMonthlyContribution > averageMonthlySavings * 0.5) {
        status = "AT_RISK";
        message += ` This is a significant share of your average monthly savings (₹${round2(averageMonthlySavings).toLocaleString("en-IN")}) but achievable with discipline.`;
      } else {
        message += ` This looks comfortably achievable given your average monthly savings.`;
      }
    }

    return {
      goalId: g.id,
      name: g.name,
      type: g.type,
      progressPercent,
      remainingAmount,
      monthsRemaining,
      requiredMonthlyContribution,
      status,
      message,
      actionLink: "/goals",
    };
  });

  return { recommendations, averageMonthlySavings: round2(averageMonthlySavings) };
}

function buildPortfolioInsights(
  investments: Array<{ id: string; name: string; category: string; currentValue: unknown; principalAmount: unknown; riskLevel: string; maturityDate: Date | null }>,
  now: Date
): PortfolioInsights {
  const totalValue = round2(investments.reduce((s, i) => s + Number(i.currentValue), 0));
  const totalInvested = round2(investments.reduce((s, i) => s + Number(i.principalAmount), 0));
  const totalProfit = round2(totalValue - totalInvested);
  const roiPercent = totalInvested > 0 ? round2((totalProfit / totalInvested) * 100) : 0;

  const byRisk = new Map<string, number>();
  const byCategory = new Map<string, number>();
  investments.forEach((inv) => {
    const value = Number(inv.currentValue);
    byRisk.set(inv.riskLevel, (byRisk.get(inv.riskLevel) ?? 0) + value);
    byCategory.set(inv.category, (byCategory.get(inv.category) ?? 0) + value);
  });

  const riskDistribution = Array.from(byRisk.entries()).map(([riskLevel, value]) => ({
    riskLevel,
    value: round2(value),
    percent: totalValue > 0 ? round2((value / totalValue) * 100) : 0,
  }));

  const topCategory = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0];
  const concentration = topCategory && totalValue > 0 ? { category: topCategory[0], percent: round2((topCategory[1] / totalValue) * 100) } : null;

  const maturityWindowEnd = new Date(now.getTime() + T.upcomingMaturityDays * 24 * 3600 * 1000);
  const upcomingMaturities = investments
    .filter((inv) => inv.maturityDate && inv.maturityDate >= now && inv.maturityDate <= maturityWindowEnd)
    .sort((a, b) => a.maturityDate!.getTime() - b.maturityDate!.getTime())
    .slice(0, 5)
    .map((inv) => ({ id: inv.id, name: inv.name, maturityDate: inv.maturityDate!.toISOString(), currentValue: round2(Number(inv.currentValue)) }));

  const insights: string[] = [];
  if (totalValue === 0) {
    insights.push("No investments recorded yet.");
  } else {
    if (roiPercent < 0) insights.push(`Your portfolio is currently in a loss position (${roiPercent}%). Review underperforming holdings.`);
    if (concentration && concentration.percent >= T.concentrationCriticalPercent) {
      insights.push(`${concentration.percent}% of your portfolio is concentrated in ${concentration.category} — consider diversifying to reduce risk.`);
    } else if (concentration && concentration.percent >= T.concentrationWarningPercent) {
      insights.push(`Over half your portfolio (${concentration.percent}%) is in ${concentration.category}. Keep an eye on diversification.`);
    }
    const highRisk = riskDistribution.find((r) => r.riskLevel === "HIGH");
    if (highRisk && highRisk.percent >= T.highRiskSharePercent) {
      insights.push(`${highRisk.percent}% of your investments carry HIGH risk — make sure this matches your risk tolerance.`);
    }
    if (upcomingMaturities.length > 0) {
      insights.push(`You have ${upcomingMaturities.length} investment(s) maturing in the next ${T.upcomingMaturityDays} days — plan your reinvestment.`);
    }
    if (insights.length === 0) insights.push("Your portfolio looks reasonably diversified with no major red flags.");
  }

  return { totalValue, totalInvested, totalProfit, roiPercent, riskDistribution, concentration, upcomingMaturities, insights };
}
