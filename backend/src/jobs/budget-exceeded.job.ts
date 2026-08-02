import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { isNotificationEnabled } from "../utils/notification-preferences";

function round2(value: number) {
  return Number(value.toFixed(2));
}

async function notifyOnce(userId: string, meta: Record<string, unknown>, title: string, message: string) {
  if (!(await isNotificationEnabled(userId, "budgetExceeded"))) return;

  const metaJson = meta as Prisma.InputJsonObject;
  const existing = await prisma.notification.findFirst({
    where: { userId, type: "BUDGET_EXCEEDED", meta: { equals: metaJson } },
  });
  if (existing) return;
  await prisma.notification.create({
    data: { userId, type: "BUDGET_EXCEEDED", title, message, meta: metaJson },
  });
}

/**
 * Flags budgets that have been exceeded for the current month, mirroring the spent
 * calculation used by budgetsService.getSummary(). Notifies once per budget per month.
 */
export async function runBudgetExceededCheck() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const budgets = await prisma.budget.findMany({ where: { month, year } });
  if (budgets.length === 0) {
    logger.info({ created: 0 }, "Budget exceeded check completed");
    return;
  }

  const userIds = [...new Set(budgets.map((b) => b.userId))];
  const expenses = await prisma.expense.findMany({
    where: {
      userId: { in: userIds },
      date: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59, 999) },
    },
  });

  const totalSpentByUser = new Map<string, number>();
  const spentByUserCategory = new Map<string, number>();
  for (const expense of expenses) {
    const amount = Number(expense.amount);
    totalSpentByUser.set(expense.userId, (totalSpentByUser.get(expense.userId) ?? 0) + amount);
    const key = `${expense.userId}:${expense.category}`;
    spentByUserCategory.set(key, (spentByUserCategory.get(key) ?? 0) + amount);
  }

  let created = 0;
  for (const budget of budgets) {
    const amount = Number(budget.amount);
    const spent = budget.category
      ? (spentByUserCategory.get(`${budget.userId}:${budget.category}`) ?? 0)
      : (totalSpentByUser.get(budget.userId) ?? 0);

    if (spent <= amount) continue;

    const label = budget.category ? budget.category.toLowerCase().replace(/_/g, " ") : "overall";
    await notifyOnce(
      budget.userId,
      { budgetId: budget.id, month, year },
      "Budget exceeded",
      `You've spent ${round2(spent)} against your ${label} budget of ${round2(amount)} this month.`,
    );
    created += 1;
  }

  logger.info({ created }, "Budget exceeded check completed");
}
