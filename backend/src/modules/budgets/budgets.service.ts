import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { UpsertBudgetInput } from "./budgets.dto";

function round2(value: number) {
  return Number(value.toFixed(2));
}

export const budgetsService = {
  async getSummary(userId: string, month: number, year: number, familyMemberId?: string) {
    const [budgets, expenses] = await Promise.all([
      prisma.budget.findMany({
        where: { userId, month, year, ...(familyMemberId ? { familyMemberId } : {}) },
        include: { familyMember: { select: { name: true } } },
      }),
      prisma.expense.findMany({
        where: {
          userId,
          date: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59, 999) },
          ...(familyMemberId ? { familyMemberId } : {}),
        },
      }),
    ]);

    const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const byCategory = new Map<string, number>();
    expenses.forEach((e) => byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount)));

    const items = budgets
      .map((b) => {
        const amount = Number(b.amount);
        const spent = b.category ? byCategory.get(b.category) ?? 0 : totalSpent;
        return {
          id: b.id,
          category: b.category,
          month: b.month,
          year: b.year,
          amount: round2(amount),
          spent: round2(spent),
          remaining: round2(amount - spent),
          percentUsed: amount > 0 ? round2(Math.min(999, (spent / amount) * 100)) : 0,
          familyMemberId: b.familyMemberId,
          familyMemberName: b.familyMember?.name ?? null,
        };
      })
      .sort((a, b) => (a.category === null ? -1 : b.category === null ? 1 : a.category.localeCompare(b.category)));

    return { items, totalSpent: round2(totalSpent) };
  },

  async upsert(userId: string, input: UpsertBudgetInput) {
    const category = input.category ?? null;
    const familyMemberId = input.familyMemberId ?? null;
    const existing = await prisma.budget.findFirst({
      where: { userId, month: input.month, year: input.year, category, familyMemberId },
    });

    if (existing) {
      return prisma.budget.update({ where: { id: existing.id }, data: { amount: input.amount } });
    }

    return prisma.budget.create({
      data: { userId, category, month: input.month, year: input.year, amount: input.amount, familyMemberId },
    });
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.budget.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Budget not found");
    await prisma.budget.delete({ where: { id } });
  },
};
