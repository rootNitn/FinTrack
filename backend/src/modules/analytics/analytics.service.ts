import { prisma } from "../../config/prisma";

function round2(value: number) {
  return Number(value.toFixed(2));
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (n - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

async function buildIncomeVsExpense(userId: string) {
  const since = monthsAgo(12);
  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({ where: { userId, date: { gte: since } }, select: { amount: true, date: true } }),
    prisma.expense.findMany({ where: { userId, date: { gte: since } }, select: { amount: true, date: true } }),
  ]);

  const byMonth = new Map<string, { income: number; expense: number }>();
  incomes.forEach((i) => {
    const key = monthKey(i.date);
    const entry = byMonth.get(key) ?? { income: 0, expense: 0 };
    entry.income += Number(i.amount);
    byMonth.set(key, entry);
  });
  expenses.forEach((e) => {
    const key = monthKey(e.date);
    const entry = byMonth.get(key) ?? { income: 0, expense: 0 };
    entry.expense += Number(e.amount);
    byMonth.set(key, entry);
  });

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([label, v]) => ({
      label,
      income: round2(v.income),
      expense: round2(v.expense),
      savings: round2(v.income - v.expense),
    }));
}

async function buildExpenseHeatmap(userId: string) {
  const since = monthsAgo(12);
  const expenses = await prisma.expense.findMany({
    where: { userId, date: { gte: since } },
    select: { amount: true, date: true },
  });

  const byDay = new Map<string, number>();
  expenses.forEach((e) => {
    const key = dayKey(e.date);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(e.amount));
  });

  return Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, value]) => ({ date, value: round2(value) }));
}

async function buildMonthlySavingsRate(userId: string) {
  const incomeVsExpense = await buildIncomeVsExpense(userId);
  return incomeVsExpense.map((m) => ({
    label: m.label,
    income: m.income,
    expense: m.expense,
    savingsRate: m.income > 0 ? round2((m.savings / m.income) * 100) : 0,
  }));
}

async function buildNetWorthGrowth(userId: string) {
  const snapshots = await prisma.monthlySnapshot.findMany({
    where: { userId },
    orderBy: [{ year: "asc" }, { month: "asc" }],
    take: 24,
  });
  return snapshots.map((s) => ({
    label: `${s.year}-${String(s.month).padStart(2, "0")}`,
    netWorth: round2(Number(s.netWorth)),
  }));
}

async function buildInvestmentPerformance(userId: string) {
  const [investments, snapshots] = await Promise.all([
    prisma.investment.findMany({ where: { userId } }),
    prisma.monthlySnapshot.findMany({
      where: { userId },
      orderBy: [{ year: "asc" }, { month: "asc" }],
      take: 24,
    }),
  ]);

  const totalInvested = investments.reduce((sum, i) => sum + Number(i.principalAmount), 0);
  const currentValue = investments.reduce((sum, i) => sum + Number(i.currentValue), 0);
  const totalProfit = currentValue - totalInvested;
  const roiPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  const byCategory = new Map<string, { invested: number; currentValue: number }>();
  investments.forEach((inv) => {
    const entry = byCategory.get(inv.category) ?? { invested: 0, currentValue: 0 };
    entry.invested += Number(inv.principalAmount);
    entry.currentValue += Number(inv.currentValue);
    byCategory.set(inv.category, entry);
  });

  const categoryPerformance = Array.from(byCategory.entries())
    .map(([category, v]) => {
      const profit = v.currentValue - v.invested;
      return {
        category,
        invested: round2(v.invested),
        currentValue: round2(v.currentValue),
        profit: round2(profit),
        roiPercent: v.invested > 0 ? round2((profit / v.invested) * 100) : 0,
      };
    })
    .sort((a, b) => b.currentValue - a.currentValue);

  const trend = snapshots.map((s) => ({
    label: `${s.year}-${String(s.month).padStart(2, "0")}`,
    investmentValue: round2(Number(s.investmentValue)),
  }));

  return {
    totalInvested: round2(totalInvested),
    currentValue: round2(currentValue),
    totalProfit: round2(totalProfit),
    roiPercent: round2(roiPercent),
    categoryPerformance,
    trend,
  };
}

async function buildCategorySpending(userId: string) {
  const since = monthsAgo(12);
  const expenses = await prisma.expense.findMany({
    where: { userId, date: { gte: since } },
    select: { amount: true, category: true },
  });

  const byCategory = new Map<string, number>();
  let total = 0;
  expenses.forEach((e) => {
    const amount = Number(e.amount);
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amount);
    total += amount;
  });

  return Array.from(byCategory.entries())
    .map(([category, amount]) => ({
      category,
      amount: round2(amount),
      percent: total > 0 ? round2((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

async function buildYearOverYear(userId: string) {
  const [incomes, expenses, snapshots] = await Promise.all([
    prisma.income.findMany({ where: { userId }, select: { amount: true, date: true } }),
    prisma.expense.findMany({ where: { userId }, select: { amount: true, date: true } }),
    prisma.monthlySnapshot.findMany({ where: { userId }, orderBy: [{ year: "asc" }, { month: "asc" }] }),
  ]);

  const byYear = new Map<number, { income: number; expense: number }>();
  incomes.forEach((i) => {
    const year = i.date.getFullYear();
    const entry = byYear.get(year) ?? { income: 0, expense: 0 };
    entry.income += Number(i.amount);
    byYear.set(year, entry);
  });
  expenses.forEach((e) => {
    const year = e.date.getFullYear();
    const entry = byYear.get(year) ?? { income: 0, expense: 0 };
    entry.expense += Number(e.amount);
    byYear.set(year, entry);
  });

  // Latest snapshot per year gives an end-of-year net worth approximation.
  const netWorthByYear = new Map<number, number>();
  snapshots.forEach((s) => netWorthByYear.set(s.year, Number(s.netWorth)));

  const years = Array.from(byYear.keys()).sort((a, b) => a - b);
  let prev: { income: number; expense: number; netWorth: number } | null = null;

  return years.map((year) => {
    const v = byYear.get(year)!;
    const netWorth = netWorthByYear.get(year) ?? 0;
    const savings = v.income - v.expense;
    const row = {
      year,
      income: round2(v.income),
      expense: round2(v.expense),
      savings: round2(savings),
      netWorth: round2(netWorth),
      incomeGrowthPercent: prev && prev.income > 0 ? round2(((v.income - prev.income) / prev.income) * 100) : null,
      expenseGrowthPercent: prev && prev.expense > 0 ? round2(((v.expense - prev.expense) / prev.expense) * 100) : null,
      netWorthGrowthPercent: prev && prev.netWorth > 0 ? round2(((netWorth - prev.netWorth) / prev.netWorth) * 100) : null,
    };
    prev = { income: v.income, expense: v.expense, netWorth };
    return row;
  });
}

export const analyticsService = {
  async getAnalytics(userId: string) {
    const [
      incomeVsExpense,
      expenseHeatmap,
      monthlySavingsRate,
      netWorthGrowth,
      investmentPerformance,
      categorySpending,
      yearOverYear,
    ] = await Promise.all([
      buildIncomeVsExpense(userId),
      buildExpenseHeatmap(userId),
      buildMonthlySavingsRate(userId),
      buildNetWorthGrowth(userId),
      buildInvestmentPerformance(userId),
      buildCategorySpending(userId),
      buildYearOverYear(userId),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      incomeVsExpense,
      expenseHeatmap,
      monthlySavingsRate,
      netWorthGrowth,
      investmentPerformance,
      categorySpending,
      yearOverYear,
    };
  },
};
