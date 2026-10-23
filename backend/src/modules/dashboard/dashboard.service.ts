import { prisma } from "../../config/prisma";
import { serializeInvestment } from "../investments/investments.service";
import { computeGoalProgress, computeRoiPercent, computeUserNetWorth, round2 } from "../../utils/finance-calculations.util";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export const dashboardService = {
  async getKpis(userId: string) {
    const [investments, bankAccounts, goals, monthIncome, monthExpense] = await Promise.all([
      prisma.investment.findMany({ where: { userId } }),
      prisma.bankAccount.findMany({ where: { userId } }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.income.aggregate({
        where: { userId, date: { gte: startOfMonth(), lte: endOfMonth() } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { userId, date: { gte: startOfMonth(), lte: endOfMonth() } },
        _sum: { amount: true },
      }),
    ]);

    const totalInvested = investments.reduce((sum, i) => sum + Number(i.principalAmount), 0);
    const currentValue = investments.reduce((sum, i) => sum + Number(i.currentValue), 0);
    const totalProfit = currentValue - totalInvested;
    const roiPercent = computeRoiPercent(totalInvested, currentValue);
    const cashAvailable = bankAccounts.reduce((sum, b) => sum + Number(b.balance), 0);
    const netWorthSummary = await computeUserNetWorth(userId);
    const netWorth = netWorthSummary.netWorth;
    const goalProgress =
      goals.length > 0
        ? goals.reduce((sum, g) => {
            const target = Number(g.targetAmount);
            const current = Number(g.currentAmount);
            return sum + computeGoalProgress(current, target).progressPercent;
          }, 0) / goals.length
        : 0;

    return {
      netWorth: round2(netWorth),
      totalInvested: round2(totalInvested),
      currentValue: round2(currentValue),
      totalProfit: round2(totalProfit),
      roiPercent: round2(roiPercent),
      goalProgress: round2(goalProgress),
      monthlyIncome: round2(Number(monthIncome._sum.amount ?? 0)),
      monthlyExpenses: round2(Number(monthExpense._sum.amount ?? 0)),
      cashAvailable: round2(cashAvailable),
    };
  },

  async getAssetAllocation(userId: string) {
    const investments = await prisma.investment.findMany({ where: { userId } });
    const byCategory = new Map<string, number>();
    investments.forEach((inv) => {
      byCategory.set(inv.category, (byCategory.get(inv.category) ?? 0) + Number(inv.currentValue));
    });
    return Array.from(byCategory.entries()).map(([name, value]) => ({ name, value: round2(value) }));
  },

  async getNetWorthGrowth(userId: string) {
    const snapshots = await prisma.monthlySnapshot.findMany({
      where: { userId },
      orderBy: [{ year: "asc" }, { month: "asc" }],
      take: 24,
    });
    return snapshots.map((s) => ({
      label: `${s.year}-${String(s.month).padStart(2, "0")}`,
      netWorth: round2(Number(s.netWorth)),
    }));
  },

  async getCurrentVsTarget(userId: string) {
    const investments = await prisma.investment.findMany({ where: { userId, targetValue: { not: null } } });
    const byCategory = new Map<string, { current: number; target: number }>();
    investments.forEach((inv) => {
      const entry = byCategory.get(inv.category) ?? { current: 0, target: 0 };
      entry.current += Number(inv.currentValue);
      entry.target += Number(inv.targetValue ?? 0);
      byCategory.set(inv.category, entry);
    });
    return Array.from(byCategory.entries()).map(([category, v]) => ({
      category,
      current: round2(v.current),
      target: round2(v.target),
    }));
  },

  async getProfitByCategory(userId: string) {
    const investments = await prisma.investment.findMany({ where: { userId } });
    const byCategory = new Map<string, number>();
    investments.forEach((inv) => {
      const profit = Number(inv.currentValue) - Number(inv.principalAmount);
      byCategory.set(inv.category, (byCategory.get(inv.category) ?? 0) + profit);
    });
    return Array.from(byCategory.entries())
      .map(([category, profit]) => ({ category, profit: round2(profit) }))
      .sort((a, b) => b.profit - a.profit);
  },

  async getMonthlyInvestmentTrend(userId: string) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    const transactions = await prisma.transaction.findMany({
      where: { userId, type: { in: ["INVESTMENT_BUY", "SIP"] }, date: { gte: twelveMonthsAgo } },
    });

    const byMonth = new Map<string, number>();
    transactions.forEach((t) => {
      const key = monthKey(t.date);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(t.amount));
    });

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([label, amount]) => ({ label, amount: round2(amount) }));
  },

  async getExpenseBreakdown(userId: string) {
    const expenses = await prisma.expense.findMany({
      where: { userId, date: { gte: startOfMonth(), lte: endOfMonth() } },
    });
    const byCategory = new Map<string, number>();
    expenses.forEach((e) => {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
    });
    return Array.from(byCategory.entries()).map(([name, value]) => ({ name, value: round2(value) }));
  },

  async getIncomeVsExpense(userId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const [incomes, expenses] = await Promise.all([
      prisma.income.findMany({ where: { userId, date: { gte: sixMonthsAgo } } }),
      prisma.expense.findMany({ where: { userId, date: { gte: sixMonthsAgo } } }),
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
      .map(([label, v]) => ({ label, income: round2(v.income), expense: round2(v.expense) }));
  },

  async getTopInvestments(userId: string, take = 10) {
    const investments = await prisma.investment.findMany({
      where: { userId },
      orderBy: { currentValue: "desc" },
      take,
    });
    return investments.map(serializeInvestment);
  },

  async getSummary(userId: string) {
    const [kpis, assetAllocation, netWorthGrowth, currentVsTarget, profitByCategory, monthlyInvestmentTrend, expenseBreakdown, incomeVsExpense, topInvestments] =
      await Promise.all([
        this.getKpis(userId),
        this.getAssetAllocation(userId),
        this.getNetWorthGrowth(userId),
        this.getCurrentVsTarget(userId),
        this.getProfitByCategory(userId),
        this.getMonthlyInvestmentTrend(userId),
        this.getExpenseBreakdown(userId),
        this.getIncomeVsExpense(userId),
        this.getTopInvestments(userId),
      ]);

    return {
      kpis,
      charts: {
        assetAllocation,
        netWorthGrowth,
        currentVsTarget,
        profitByCategory,
        monthlyInvestmentTrend,
        expenseBreakdown,
        incomeVsExpense,
        topInvestments,
      },
    };
  },
};
