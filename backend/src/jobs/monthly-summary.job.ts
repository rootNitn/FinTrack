import { InvestmentStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { computeUserNetWorth } from "../utils/finance-calculations.util";

/**
 * Runs at the start of each month: computes a MonthlySnapshot for the *previous* month for
 * every user (net worth, investment value, income, expenses, savings, profit) and sends a
 * MONTHLY_SUMMARY notification. Powers the "Monthly Tracker" feature.
 */
export async function runMonthlySummaryJob() {
  const now = new Date();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = prevMonthDate.getMonth() + 1;
  const year = prevMonthDate.getFullYear();
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);

  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });

  for (const { id: userId } of users) {
    const [incomeAgg, expenseAgg, activeInvestments, netWorthSummary] = await Promise.all([
      prisma.income.aggregate({ where: { userId, date: { gte: from, lte: to } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { userId, date: { gte: from, lte: to } }, _sum: { amount: true } }),
      prisma.investment.findMany({ where: { userId, status: InvestmentStatus.ACTIVE } }),
      // Same "assets minus liabilities" formula as dashboard/analytics/ai-insights/reports —
      // avoids under-counting net worth by ignoring FDs/credit-card debt/liabilities.
      computeUserNetWorth(userId),
    ]);

    const income = Number(incomeAgg._sum.amount ?? 0);
    const expenses = Number(expenseAgg._sum.amount ?? 0);
    const investmentValue = activeInvestments.reduce((sum, i) => sum + Number(i.currentValue), 0);
    const invested = activeInvestments.reduce((sum, i) => sum + Number(i.principalAmount), 0);
    const netWorth = netWorthSummary.netWorth;
    const profit = investmentValue - invested;
    const savings = income - expenses;

    await prisma.monthlySnapshot.upsert({
      where: { userId_month_year: { userId, month, year } },
      create: { userId, month, year, netWorth, investmentValue, income, expenses, savings, profit },
      update: { netWorth, investmentValue, income, expenses, savings, profit },
    });

    const setting = await prisma.setting.findUnique({ where: { userId } });
    const preferences = (setting?.notificationPreferences as Record<string, boolean>) ?? {};
    if (preferences.monthlySummary === false) continue;

    // Dedup: a re-run in the same month (server restart, manual trigger) must not re-notify.
    const alreadyNotified = await prisma.notification.findFirst({
      where: {
        userId,
        type: "MONTHLY_SUMMARY",
        AND: [{ meta: { path: ["month"], equals: month } }, { meta: { path: ["year"], equals: year } }],
      },
    });
    if (alreadyNotified) continue;

    await prisma.notification.create({
      data: {
        userId,
        type: "MONTHLY_SUMMARY",
        title: `${prevMonthDate.toLocaleString("default", { month: "long" })} summary`,
        message: `Net worth: ${netWorth.toFixed(2)} · Savings: ${savings.toFixed(2)} · Profit: ${profit.toFixed(2)}.`,
        meta: { month, year },
      },
    });
  }

  logger.info({ month, year, userCount: users.length }, "Monthly summary job completed");
}
