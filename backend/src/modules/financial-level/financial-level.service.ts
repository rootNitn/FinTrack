import { prisma } from "../../config/prisma";
import { financialHealthService } from "../financial-health/financial-health.service";
import { FINANCIAL_LEVELS, LevelGate, safePercent, scoreLevel } from "./financial-level.util";

function round(value: number) { return Number(value.toFixed(2)); }

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function legacySourceName(source: string): string {
  return {
    SALARY: "Salary",
    FREELANCING: "Freelancing",
    INTEREST: "Interest",
    DIVIDEND: "Dividends",
    RENTAL_INCOME: "Rental income",
    OTHER_INCOME: "Other income",
  }[source] ?? source;
}

export const financialLevelService = {
  async getSummary(userId: string) {
    const [health, sources, currentMonthIncomes] = await Promise.all([
      financialHealthService.getSummary(userId),
      prisma.incomeSourceProfile.findMany({ where: { userId, isActive: true }, orderBy: { monthlyAverageAmount: "desc" } }),
      prisma.income.findMany({ where: { userId, date: { gte: startOfMonth(), lte: endOfMonth() } }, select: { source: true, amount: true } }),
    ]);
    const legacyTotals = currentMonthIncomes.reduce((totals, income) => {
      totals.set(income.source, (totals.get(income.source) ?? 0) + Number(income.amount));
      return totals;
    }, new Map<string, number>());
    const profileSources = sources.map((source) => ({ ...source, monthlyAmount: Number(source.monthlyAverageAmount) }));
    const profileTypes = new Set(profileSources.map((source) => source.type.toUpperCase()));
    const legacySources = Array.from(legacyTotals.entries())
      .filter(([source]) => !profileTypes.has(source) && ["INTEREST", "DIVIDEND", "RENTAL_INCOME"].includes(source))
      .map(([source, monthlyAmount]) => ({
        id: `legacy-${source}`,
        name: legacySourceName(source),
        type: source,
        incomeMode: "PASSIVE" as const,
        monthlyAmount,
      }));
    const activeSources = sources.length
      ? [...profileSources, ...legacySources]
      : Array.from(legacyTotals.entries())
          .map(([source, monthlyAmount]) => ({
            id: `legacy-${source}`,
            name: legacySourceName(source),
            type: source,
            incomeMode: ["INTEREST", "DIVIDEND", "RENTAL_INCOME"].includes(source) ? "PASSIVE" as const : "ACTIVE" as const,
            monthlyAmount,
          }))
          .sort((a, b) => b.monthlyAmount - a.monthlyAmount);
    const expensesRule = health.rules.find((rule) => rule.id === "savings-rate");
    const emergencyRule = health.rules.find((rule) => rule.id === "emergency-fund");
    const debtRule = health.rules.find((rule) => rule.id === "debt-health");
    const goalRule = health.rules.find((rule) => rule.id.startsWith("goal-funding-"));
    const incomeBenchmark = health.benchmarks.find((rule) => rule.id === "50-30-20");
    // Keep this aligned with Dashboard: the headline total is actual income recorded this month.
    // Source profiles remain metadata for dependency and active/passive classification.
    const recordedMonthlyIncome = Number(incomeBenchmark?.data.monthlyIncome ?? 0);
    const totalIncome = recordedMonthlyIncome > 0 ? recordedMonthlyIncome : activeSources.reduce((sum, source) => sum + source.monthlyAmount, 0);
    const primary = activeSources[0]?.monthlyAmount ?? 0;
    const passiveIncome = activeSources.filter((source) => source.incomeMode !== "ACTIVE").reduce((sum, source) => sum + source.monthlyAmount, 0);
    const activeIncome = Math.max(0, totalIncome - passiveIncome);
    const primaryDependencyPercent = safePercent(primary, totalIncome);
    const passiveIncomePercent = safePercent(passiveIncome, totalIncome);
    const emergencyMonths = emergencyRule?.data.monthsCovered ?? null;
    const savingsRate = expensesRule?.data.savingsRatePercent ?? null;
    const debtRatio = debtRule?.data.debtToIncomePercent ?? null;
    const monthlyExpenses = recordedMonthlyIncome > 0 && savingsRate !== null ? recordedMonthlyIncome * (1 - savingsRate / 100) : 0;
    const annualExpenses = monthlyExpenses > 0 ? monthlyExpenses * 12 : null;
    const fiNumber = annualExpenses !== null ? annualExpenses * 25 : null;
    const fiProgressPercent = fiNumber !== null ? safePercent(health.netWorth.totalAssets, fiNumber) : null;
    const incomeReplacementRatio = safePercent(passiveIncome, monthlyExpenses);
    const gates: LevelGate[] = [
      { id: "emergency-fund", label: "Emergency fund covers at least 6 months", passed: emergencyMonths !== null && emergencyMonths >= 6, current: emergencyMonths, target: 6 },
      { id: "positive-cash-flow", label: "Savings rate is positive", passed: savingsRate !== null && savingsRate > 0, current: savingsRate, target: 0 },
      { id: "manageable-debt", label: "Debt ratio stays below 35%", passed: debtRatio !== null && debtRatio < 35, current: debtRatio, target: 35 },
      { id: "income-diversification", label: "Primary income dependency is below 75%", passed: primaryDependencyPercent !== null && primaryDependencyPercent < 75, current: primaryDependencyPercent, target: 75 },
      { id: "goal-progress", label: "At least one goal is progressing", passed: Boolean(goalRule && goalRule.status !== "critical"), current: goalRule?.data.fundingPercent ?? null, target: 25 },
      { id: "financial-independence", label: "Investment corpus reaches the FI target", passed: fiProgressPercent !== null && fiProgressPercent >= 100, current: fiProgressPercent, target: 100 },
      { id: "passive-expense-coverage", label: "Passive income covers monthly expenses", passed: incomeReplacementRatio !== null && incomeReplacementRatio >= 100, current: incomeReplacementRatio, target: 100 },
    ];
    const currentLevel = scoreLevel(health.overallScore, gates);
    const currentIndex = FINANCIAL_LEVELS.findIndex((level) => level.name === currentLevel.name);
    const nextLevel = FINANCIAL_LEVELS[currentIndex + 1] ?? null;
    const nextGateIds = nextLevel?.requiredGateIds ?? [];
    const scoreGap = nextLevel && health.overallScore !== null ? Math.max(0, nextLevel.minimumScore - health.overallScore) : 0;
    const missingRequirements = [
      ...(scoreGap > 0 ? [`Increase your Financial Strength Score by ${scoreGap} points to reach ${nextLevel!.label}`] : []),
      ...gates.filter((gate) => nextGateIds.includes(gate.id) && !gate.passed).map((gate) => gate.label),
    ];
    const recommendations = [
      ...(scoreGap > 0 ? [{
        id: "score-gap",
        priority: 1,
        title: `Close the ${scoreGap}-point score gap`,
        current: health.overallScore,
        target: nextLevel!.minimumScore,
        message: `Your configured gates are met. Improve the underlying health metrics to move from ${health.overallScore}/100 to ${nextLevel!.minimumScore}/100.`,
      }] : []),
      ...gates.filter((gate) => nextGateIds.includes(gate.id) && !gate.passed).map((gate, index) => ({
      id: gate.id,
      priority: index + 2,
      title: gate.label,
      current: gate.current,
      target: gate.target,
      message: gate.id === "income-diversification" ? "Add or strengthen a second income stream to reduce dependency on one source." : `Move this metric toward ${gate.target}${gate.id === "emergency-fund" ? " months" : "%"}.`,
      })),
    ].slice(0, 5);
    return {
      currentLevel: { ...currentLevel, score: health.overallScore },
      nextLevel: nextLevel ? { ...nextLevel, requiredScore: nextLevel.minimumScore } : null,
      scoreChange: health.netWorth.growthPercent,
      gates,
      missingRequirements,
      recommendations,
      incomeDiversification: {
        sourceCount: activeSources.length,
        primaryDependencyPercent,
        status: primaryDependencyPercent === null ? "No data" : primaryDependencyPercent <= 60 ? "Diversified" : primaryDependencyPercent <= 75 ? "Moderate dependency" : "High dependency",
        sources: activeSources.map((source) => ({ id: source.id, name: source.name, type: source.type, mode: source.incomeMode, monthlyAmount: source.monthlyAmount, percent: safePercent(source.monthlyAmount, totalIncome) })),
      },
      income: { totalMonthly: round(totalIncome), activeMonthly: round(activeIncome), passiveMonthly: round(passiveIncome), passivePercent: passiveIncomePercent },
      incomeReplacementRatio,
      financialIndependence: { annualExpenses, fiNumber, currentCorpus: health.netWorth.totalAssets, progressPercent: fiProgressPercent },
      netWorth: health.netWorth,
      health,
    };
  },
};
