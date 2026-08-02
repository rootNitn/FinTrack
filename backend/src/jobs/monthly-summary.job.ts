import { prisma } from "../config/prisma";
import { logger } from "../config/logger";

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

    await prisma.monthlySnapshot.upsert({
      where: { userId_month_year: { userId, month, year } },
      create: { userId, month, year, netWorth, investmentValue, income, expenses, savings, profit },
      update: { netWorth, investmentValue, income, expenses, savings, profit },
    });

    const setting = await prisma.setting.findUnique({ where: { userId } });
    const preferences = (setting?.notificationPreferences as Record<string, boolean>) ?? {};
    if (preferences.monthlySummary !== false) {
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
  }

  logger.info({ month, year, userCount: users.length }, "Monthly summary job completed");
}
