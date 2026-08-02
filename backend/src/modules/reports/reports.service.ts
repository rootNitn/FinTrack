import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { serializeInvestment } from "../investments/investments.service";
import { ReportQuery } from "./reports.dto";

function round2(value: number) {
  return Number(value.toFixed(2));
}

async function aggregatePeriod(userId: string, from: Date, to: Date) {
  const [incomeAgg, expenseAgg, investments, bankAccounts] = await Promise.all([
    prisma.income.aggregate({ where: { userId, date: { gte: from, lte: to } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { userId, date: { gte: from, lte: to } }, _sum: { amount: true } }),
    prisma.investment.findMany({ where: { userId } }),
    prisma.bankAccount.findMany({ where: { userId } }),
  ]);

  const income = Number(incomeAgg._sum.amount ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  const investmentValue = investments.reduce((sum, i) => sum + Number(i.currentValue), 0);
  const invested = investments.reduce((sum, i) => sum + Number(i.principalAmount), 0);
  const cash = bankAccounts.reduce((sum, b) => sum + Number(b.balance), 0);
  const netWorth = investmentValue + cash;
  const profit = investmentValue - invested;
  const savings = income - expenses;

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    income: round2(income),
    expenses: round2(expenses),
    savings: round2(savings),
    investmentValue: round2(investmentValue),
    netWorth: round2(netWorth),
    profit: round2(profit),
  };
}

export const reportsService = {
  async generate(userId: string, query: ReportQuery) {
    const now = new Date();
    const year = query.year ?? now.getFullYear();

    switch (query.type) {
      case "monthly": {
        const month = query.month ?? now.getMonth() + 1;
        const from = new Date(year, month - 1, 1);
        const to = new Date(year, month, 0, 23, 59, 59, 999);
        return { type: "monthly", period: `${year}-${String(month).padStart(2, "0")}`, ...(await aggregatePeriod(userId, from, to)) };
      }
      case "quarterly": {
        const quarter = query.quarter ?? Math.floor(now.getMonth() / 3) + 1;
        const startMonth = (quarter - 1) * 3;
        const from = new Date(year, startMonth, 1);
        const to = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
        return { type: "quarterly", period: `Q${quarter} ${year}`, ...(await aggregatePeriod(userId, from, to)) };
      }
      case "yearly": {
        const from = new Date(year, 0, 1);
        const to = new Date(year, 11, 31, 23, 59, 59, 999);
        return { type: "yearly", period: `${year}`, ...(await aggregatePeriod(userId, from, to)) };
      }
      case "investment": {
        const investments = await prisma.investment.findMany({ where: { userId }, orderBy: { purchaseDate: "desc" } });
        const rows = investments.map(serializeInvestment);
        const totals = rows.reduce(
          (acc, r) => ({
            invested: acc.invested + r.principalAmount,
            currentValue: acc.currentValue + r.currentValue,
            profit: acc.profit + r.profit,
          }),
          { invested: 0, currentValue: 0, profit: 0 }
        );
        return { type: "investment", rows, totals: { ...totals, roiPercent: totals.invested > 0 ? round2((totals.profit / totals.invested) * 100) : 0 } };
      }
      case "expense": {
        const from = query.from ? new Date(query.from) : new Date(year, 0, 1);
        const to = query.to ? new Date(query.to) : new Date(year, 11, 31, 23, 59, 59, 999);
        const expenses = await prisma.expense.findMany({ where: { userId, date: { gte: from, lte: to } }, orderBy: { date: "desc" } });
        const byCategory = new Map<string, number>();
        expenses.forEach((e) => byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount)));
        return {
          type: "expense",
          rows: expenses.map((e) => ({ ...e, amount: Number(e.amount) })),
          byCategory: Array.from(byCategory.entries()).map(([category, amount]) => ({ category, amount: round2(amount) })),
          total: round2(expenses.reduce((sum, e) => sum + Number(e.amount), 0)),
        };
      }
      case "goal": {
        const goals = await prisma.goal.findMany({ where: { userId }, orderBy: { deadline: "asc" } });
        const rows = goals.map((g) => {
          const target = Number(g.targetAmount);
          const current = Number(g.currentAmount);
          return {
            ...g,
            targetAmount: target,
            currentAmount: current,
            progressPercent: target > 0 ? round2(Math.min(100, (current / target) * 100)) : 0,
            remainingAmount: round2(Math.max(0, target - current)),
          };
        });
        return { type: "goal", rows };
      }
      default:
        throw AppError.badRequest("Unsupported report type");
    }
  },
};
