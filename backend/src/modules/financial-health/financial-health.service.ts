import { FdPortfolioStatus, InvestmentStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { CashFlow } from "../../utils/xirr.util";
import {
  classifyAssetBucket,
  computeAgeBasedAllocation,
  computeAssetAllocation,
  computeDebtHealth,
  computeDiversification,
  computeEmergencyFund,
  computeExpectedInstallments,
  computeFinancialIndependenceRatio,
  computeFiftyThirtyTwenty,
  computeGoalFunding,
  computeInsuranceScore,
  computeInvestmentDiscipline,
  computeNetWorth,
  computeRebalancingScore,
  computeRetirementReadiness,
  computeRuleOf72,
  computeSavingsRateScore,
  computeSaveTheRaise,
  computeTaxEfficiency,
  FinancialHealthRule,
  isEssentialCategory,
  isNeedCategory,
} from "./financial-health.util";

export interface ActionPlanItem {
  ruleId: string;
  title: string;
  message: string;
  severity: "critical" | "warning";
}

export interface FinancialHealthCategoryScores {
  savings: number | null;
  debt: number | null;
  investments: number | null;
  emergencyFund: number | null;
  insurance: number | null;
  goals: number | null;
  credit: number | null;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthsAgo(months: number, date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() - months, date.getDate());
}

function statusScore(status: FinancialHealthRule["status"]): number | null {
  if (status === "good") return 100;
  if (status === "warning") return 60;
  if (status === "critical") return 20;
  return null;
}

// Category weights per the target scoring model — sums to 100% across all 10 categories.
const CATEGORY_WEIGHTS: Record<string, number> = {
  "emergency-fund": 15,
  "debt-health": 15,
  "savings-rate": 10,
  "asset-allocation": 10,
  diversification: 10,
  retirement: 15,
  goals: 10,
  insurance: 5,
  "tax-efficiency": 5,
  "investment-discipline": 5,
};

function ruleCategory(ruleId: string): string | null {
  if (ruleId === "emergency-fund") return "emergency-fund";
  if (ruleId === "debt-health") return "debt-health";
  if (ruleId === "savings-rate") return "savings-rate";
  if (ruleId === "rebalancing") return "asset-allocation";
  if (ruleId === "diversification") return "diversification";
  if (ruleId === "retirement-readiness") return "retirement";
  if (ruleId.startsWith("goal-funding-")) return "goals";
  if (ruleId === "insurance") return "insurance";
  if (ruleId === "tax-efficiency") return "tax-efficiency";
  if (ruleId === "investment-discipline") return "investment-discipline";
  return null;
}

export const financialHealthService = {
  /**
   * Computes the scored Financial Health rules (Emergency Fund, Savings Rate, Rebalancing Score,
   * Debt Health, Diversification, Retirement Readiness, Insurance, Tax Efficiency, Investment
   * Discipline, Goal Funding) using weighted categories, plus a set of "benchmark" rules of thumb
   * (50/30/20, 100-Age, 60/30/10, Save the Raise, Rule of 72/114/144, FI Ratio) that are shown for
   * reference but never penalize the score — they're guidelines, not laws. Net Worth is shown
   * separately as its own informational summary, and topActions surfaces the 3 most urgent items.
   */
  async getSummary(userId: string) {
    const monthStart = startOfMonth();
    const monthEnd = endOfMonth();
    const baselineDate = monthsAgo(6);
    const baselineStart = startOfMonth(baselineDate);
    const baselineEnd = endOfMonth(baselineDate);
    const now = new Date();
    const prevSnapshotDate = monthsAgo(1, now);
    const yoySnapshotDate = monthsAgo(12, now);

    const [
      user,
      setting,
      incomes,
      expenses,
      bankAccounts,
      fds,
      investments,
      baselineIncomes,
      baselineExpenses,
      creditCards,
      liabilities,
      goals,
      prevSnapshot,
      yoySnapshot,
      familyMembers,
      insurancePolicies,
      latestTaxCalculation,
      recurringInvestments,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true } }),
      prisma.setting.findUnique({ where: { userId } }),
      prisma.income.findMany({ where: { userId, date: { gte: monthStart, lte: monthEnd } } }),
      prisma.expense.findMany({ where: { userId, date: { gte: monthStart, lte: monthEnd } } }),
      prisma.bankAccount.findMany({ where: { userId } }),
      prisma.fdPortfolio.findMany({ where: { userId, status: FdPortfolioStatus.ACTIVE } }),
      prisma.investment.findMany({ where: { userId, status: InvestmentStatus.ACTIVE } }),
      prisma.income.findMany({ where: { userId, date: { gte: baselineStart, lte: baselineEnd } } }),
      prisma.expense.findMany({ where: { userId, date: { gte: baselineStart, lte: baselineEnd } } }),
      prisma.creditCard.findMany({ where: { userId, isActive: true } }),
      prisma.liability.findMany({ where: { userId } }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.monthlySnapshot.findFirst({ where: { userId, month: prevSnapshotDate.getMonth() + 1, year: prevSnapshotDate.getFullYear() } }),
      prisma.monthlySnapshot.findFirst({ where: { userId, month: yoySnapshotDate.getMonth() + 1, year: yoySnapshotDate.getFullYear() } }),
      prisma.familyMember.findMany({ where: { userId }, select: { id: true } }),
      prisma.insurancePolicy.findMany({ where: { userId } }),
      prisma.taxCalculation.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.investment.findMany({
        where: { userId, isRecurring: true },
        select: { purchaseDate: true, recurrenceEndDate: true, recurrenceInterval: true, generatedInvestments: { select: { id: true } } },
      }),
    ]);

    // Rule 1: 50/30/20
    const monthlyIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const needsTotal = expenses.filter((e) => isNeedCategory(e.category)).reduce((sum, e) => sum + Number(e.amount), 0);
    const wantsTotal = expenses.filter((e) => !isNeedCategory(e.category)).reduce((sum, e) => sum + Number(e.amount), 0);
    const fiftyThirtyTwenty = computeFiftyThirtyTwenty(monthlyIncome, needsTotal, wantsTotal);

    // Rule 2: Emergency Fund — liquid savings vs essential monthly expense.
    const bankBalance = bankAccounts.reduce((sum, b) => sum + Number(b.balance), 0);
    const fdBalance = fds.reduce((sum, fd) => sum + Number(fd.amount), 0);
    const liquidSavings = bankBalance + fdBalance;
    const essentialMonthlyExpense = expenses.filter((e) => isEssentialCategory(e.category)).reduce((sum, e) => sum + Number(e.amount), 0);
    const emergencyFund = computeEmergencyFund(liquidSavings, essentialMonthlyExpense);

    // Rule 3: Rule of 72 — one portfolio-wide XIRR across every active investment's cash flows.
    const cashFlows: CashFlow[] = investments.map((inv) => ({ amount: -Number(inv.principalAmount), date: inv.purchaseDate }));
    const totalCurrentValue = investments.reduce((sum, inv) => sum + Number(inv.currentValue), 0);
    if (cashFlows.length > 0) cashFlows.push({ amount: totalCurrentValue, date: new Date() });
    const ruleOf72 = computeRuleOf72(cashFlows);

    // Rule 4: 60/30/10 allocation (fixed benchmark) — group current investment value into equity/debt/gold/other.
    let equityValue = 0;
    let debtValue = 0;
    let goldValue = 0;
    let otherValue = 0;
    for (const inv of investments) {
      const bucket = classifyAssetBucket(inv.category);
      const value = Number(inv.currentValue);
      if (bucket === "equity") equityValue += value;
      else if (bucket === "debt") debtValue += value;
      else if (bucket === "gold") goldValue += value;
      else otherValue += value;
    }
    const assetAllocation = computeAssetAllocation(equityValue, debtValue, goldValue, otherValue);

    // Rule 5: 100 - Age — compare current equity share against an age-based target.
    const totalInvestmentValue = equityValue + debtValue + goldValue + otherValue;
    const ageBasedAllocation = computeAgeBasedAllocation(user?.dateOfBirth ?? null, equityValue, totalInvestmentValue);

    // Rule 6: Save the Raise — compare current month vs ~6 months ago income/savings.
    const baselineIncome = baselineIncomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const baselineExpenseTotal = baselineExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const currentSavings = monthlyIncome - (needsTotal + wantsTotal);
    const baselineSavings = baselineIncome - baselineExpenseTotal;
    const saveTheRaise = computeSaveTheRaise(monthlyIncome, currentSavings, baselineIncome, baselineSavings);

    // Rule 7: Savings Rate Score — Monthly Savings / Monthly Income, scored on app-defined tiers.
    const savingsRateScore = computeSavingsRateScore(monthlyIncome, currentSavings);

    // Rule 8: Rebalancing Score — same equity/debt/gold split as the 60/30/10 benchmark, but
    // scored against the user's own chosen target (falls back to 60/30/10 if unset).
    const targetEquityPercent = setting?.targetEquityPercent ?? 60;
    const targetDebtPercent = setting?.targetDebtPercent ?? 30;
    const targetGoldPercent = setting?.targetGoldPercent ?? 10;
    const equityPercent = totalInvestmentValue > 0 ? (equityValue / totalInvestmentValue) * 100 : 0;
    const debtPercent = totalInvestmentValue > 0 ? (debtValue / totalInvestmentValue) * 100 : 0;
    const goldPercent = totalInvestmentValue > 0 ? (goldValue / totalInvestmentValue) * 100 : 0;
    const rebalancingScore = computeRebalancingScore(
      equityPercent,
      debtPercent,
      goldPercent,
      targetEquityPercent,
      targetDebtPercent,
      targetGoldPercent,
    );

    // Rule 9: Goal Funding Ratio — one rule per goal (Current Corpus ÷ Required Corpus × 100).
    const goalFundingRules = goals.map((goal) =>
      computeGoalFunding({
        id: goal.id,
        name: goal.name,
        currentAmount: Number(goal.currentAmount),
        targetAmount: Number(goal.targetAmount),
      }),
    );

    // Net Worth = Total Assets − Total Liabilities. Informational — shown separately, not scored.
    const creditCardOutstanding = creditCards.reduce((sum, c) => sum + Number(c.currentOutstanding), 0);
    const manualLiabilities = liabilities.reduce((sum, l) => sum + Number(l.amount), 0);
    const totalAssets = liquidSavings + totalInvestmentValue;
    const totalLiabilities = creditCardOutstanding + manualLiabilities;
    const netWorth = computeNetWorth(
      totalAssets,
      totalLiabilities,
      prevSnapshot ? Number(prevSnapshot.netWorth) : null,
      yoySnapshot ? Number(yoySnapshot.netWorth) : null,
    );

    // Rule 10: Debt Health — total outstanding debt vs. annual income (annualized from this month).
    const annualIncome = monthlyIncome * 12;
    const debtHealth = computeDebtHealth(creditCardOutstanding + manualLiabilities, annualIncome);

    // Rule 11: Diversification — largest single equity holding (grouped by name) vs. total equity value.
    const equityHoldingTotals = new Map<string, number>();
    for (const inv of investments) {
      if (classifyAssetBucket(inv.category) !== "equity") continue;
      equityHoldingTotals.set(inv.name, (equityHoldingTotals.get(inv.name) ?? 0) + Number(inv.currentValue));
    }
    let largestHoldingName: string | null = null;
    let largestHoldingValue = 0;
    for (const [name, value] of equityHoldingTotals) {
      if (value > largestHoldingValue) {
        largestHoldingName = name;
        largestHoldingValue = value;
      }
    }
    const diversification = computeDiversification(largestHoldingName, largestHoldingValue, equityValue);

    // Rule 12: Retirement Readiness — Investable Assets ÷ Required Corpus (Annual Retirement
    // Expense ÷ Withdrawal Rate). Falls back to current monthly expenses if no custom figure is set.
    const withdrawalRatePercent = setting?.retirementWithdrawalRatePercent ? Number(setting.retirementWithdrawalRatePercent) : 4;
    const retirementMonthlyExpense = setting?.retirementMonthlyExpense ? Number(setting.retirementMonthlyExpense) : needsTotal + wantsTotal;
    const annualRetirementExpense = retirementMonthlyExpense * 12;
    const requiredRetirementCorpus = withdrawalRatePercent > 0 ? annualRetirementExpense / (withdrawalRatePercent / 100) : 0;
    const investableAssets = totalAssets;
    const retirementReadiness = computeRetirementReadiness(investableAssets, requiredRetirementCorpus, withdrawalRatePercent);

    // Financial Independence Ratio — same formula as Retirement Readiness; shown as a benchmark
    // (not scored/weighted) since it's not part of the 10-category weight table.
    const financialIndependence = computeFinancialIndependenceRatio(investableAssets, requiredRetirementCorpus);

    // Rule 13: Insurance Protection Score.
    const healthPolicies = insurancePolicies.filter((p) => p.type === "HEALTH");
    const lifePolicies = insurancePolicies.filter((p) => p.type === "LIFE");
    const healthSumInsured = healthPolicies.reduce((sum, p) => sum + Number(p.sumInsured), 0);
    const lifeSumInsured = lifePolicies.reduce((sum, p) => sum + Number(p.sumInsured), 0);
    const insurance = computeInsuranceScore(
      healthPolicies.length > 0,
      healthSumInsured,
      familyMembers.length > 0,
      lifePolicies.length > 0,
      lifeSumInsured,
      annualIncome,
    );

    // Rule 14: Tax Efficiency Score — reuses the most recently saved Tax Calculator result.
    const taxResult = latestTaxCalculation?.result as
      | { old?: { totalTaxPayable?: number }; new?: { totalTaxPayable?: number }; recommendedRegime?: "OLD" | "NEW"; taxSaved?: number }
      | undefined;
    const cheaperRegimeTax = taxResult?.recommendedRegime
      ? (taxResult.recommendedRegime === "OLD" ? taxResult.old?.totalTaxPayable : taxResult.new?.totalTaxPayable) ?? 0
      : 0;
    const taxEfficiency = computeTaxEfficiency(
      Boolean(latestTaxCalculation),
      latestTaxCalculation?.selectedRegime ?? null,
      taxResult?.recommendedRegime ?? null,
      taxResult?.taxSaved ?? 0,
      cheaperRegimeTax,
    );

    // Rule 15: Investment Discipline (SIP consistency) — aggregated across all recurring investments.
    let actualInstallments = 0;
    let expectedInstallments = 0;
    for (const rec of recurringInvestments) {
      if (!rec.recurrenceInterval) continue;
      actualInstallments += 1 + rec.generatedInvestments.length; // parent + generated children
      expectedInstallments += computeExpectedInstallments(rec.purchaseDate, rec.recurrenceEndDate, rec.recurrenceInterval, now);
    }
    const investmentDiscipline = computeInvestmentDiscipline(actualInstallments, expectedInstallments);

    // Rules of thumb (50/30/20, 100-Age, 60/30/10, Save the Raise, Rule of 72/114/144, FI Ratio)
    // are benchmarks for reference only — they inform recommendations but never move the score.
    const rules = [
      emergencyFund,
      savingsRateScore,
      rebalancingScore,
      debtHealth,
      diversification,
      retirementReadiness,
      insurance,
      taxEfficiency,
      investmentDiscipline,
      ...goalFundingRules,
    ];
    const benchmarks = [fiftyThirtyTwenty, ageBasedAllocation, assetAllocation, saveTheRaise, ruleOf72, financialIndependence];

    // Weighted overall score: average each category's rule score(s), then weight the
    // categories per CATEGORY_WEIGHTS, renormalized across only the categories present.
    const categoryScores = new Map<string, number[]>();
    for (const rule of rules) {
      const category = ruleCategory(rule.id);
      const score = statusScore(rule.status);
      if (!category || score === null) continue;
      if (!categoryScores.has(category)) categoryScores.set(category, []);
      categoryScores.get(category)!.push(score);
    }

    let weightedSum = 0;
    let weightTotal = 0;
    for (const [category, scoresInCategory] of categoryScores) {
      const weight = CATEGORY_WEIGHTS[category] ?? 0;
      if (weight <= 0 || scoresInCategory.length === 0) continue;
      const avg = scoresInCategory.reduce((sum, s) => sum + s, 0) / scoresInCategory.length;
      weightedSum += avg * weight;
      weightTotal += weight;
    }

    const overallScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : null;
    const overallStatus: FinancialHealthRule["status"] =
      overallScore === null ? "na" : overallScore >= 80 ? "good" : overallScore >= 60 ? "warning" : "critical";

    const categoryValues = new Map<string, number>();
    for (const [category, scores] of categoryScores) {
      if (scores.length) categoryValues.set(category, Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length));
    }
    const investmentScoreParts = ["asset-allocation", "diversification", "retirement", "investment-discipline"]
      .map((category) => categoryValues.get(category))
      .filter((score): score is number => score !== undefined);
    const totalCreditLimit = creditCards.reduce((sum, card) => sum + Number(card.creditLimit), 0);
    const creditUtilization = totalCreditLimit > 0 ? (creditCardOutstanding / totalCreditLimit) * 100 : null;
    const creditScore = creditUtilization === null ? null : creditUtilization <= 30 ? 100 : creditUtilization <= 50 ? 60 : 20;
    const categoryScoresForDashboard: FinancialHealthCategoryScores = {
      savings: categoryValues.get("savings-rate") ?? null,
      debt: categoryValues.get("debt-health") ?? null,
      investments: investmentScoreParts.length ? Math.round(investmentScoreParts.reduce((sum, score) => sum + score, 0) / investmentScoreParts.length) : null,
      emergencyFund: categoryValues.get("emergency-fund") ?? null,
      insurance: categoryValues.get("insurance") ?? null,
      goals: categoryValues.get("goals") ?? null,
      credit: creditScore,
    };

    // Action Plan — top 3 actions, worst (critical) first, drawn from every scored rule that
    // isn't already "good"/"na". Reuses each rule's own recommendation text — no separate
    // "advice" system to keep in sync.
    const severityRank: Record<string, number> = { critical: 0, warning: 1 };
    const topActions: ActionPlanItem[] = rules
      .filter((r): r is FinancialHealthRule & { status: "critical" | "warning" } => r.status === "critical" || r.status === "warning")
      .sort((a, b) => severityRank[a.status] - severityRank[b.status])
      .slice(0, 3)
      .map((r) => ({ ruleId: r.id, title: r.title, message: r.recommendation, severity: r.status }));

    return { overallScore, overallStatus, rules, benchmarks, netWorth, topActions, categoryScores: categoryScoresForDashboard };
  },
};

