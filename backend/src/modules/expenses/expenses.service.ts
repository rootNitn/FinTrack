import { Prisma, RecurrenceInterval } from "@prisma/client";
import { Request } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import { CreateExpenseInput, UpdateExpenseInput } from "./expenses.dto";

function serializeExpense<T extends Record<string, unknown>>(expense: T) {
  const splits = (expense as { splits?: { amount: Prisma.Decimal }[] }).splits;
  const familyMember = (expense as { familyMember?: { name: string } | null }).familyMember;
  return {
    ...expense,
    amount: Number(expense.amount as Prisma.Decimal),
    ...(splits ? { splits: splits.map((s) => ({ ...s, amount: Number(s.amount) })) } : {}),
    familyMemberName: familyMember?.name ?? null,
    familyMember: undefined,
  };
}

function addInterval(date: Date, interval: RecurrenceInterval): Date {
  const next = new Date(date);
  if (interval === "WEEKLY") next.setDate(next.getDate() + 7);
  else if (interval === "MONTHLY") next.setMonth(next.getMonth() + 1);
  else if (interval === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  return next;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function maybeCreateLargeExpenseAlert(userId: string, amount: number, category: string) {
  const setting = await prisma.setting.findUnique({ where: { userId } });
  const threshold = setting ? Number(setting.largeExpenseThreshold) : 10000;
  const preferences = (setting?.notificationPreferences as Record<string, boolean>) ?? {};
  if (preferences.largeExpenseAlert === false) return;

  if (amount >= threshold) {
    await prisma.notification.create({
      data: {
        userId,
        type: "LARGE_EXPENSE_ALERT",
        title: "Large expense recorded",
        message: `A ${category} expense of ${amount.toFixed(2)} exceeded your alert threshold of ${threshold.toFixed(2)}.`,
      },
    });
  }
}

export const expensesService = {
  async list(userId: string, req: Request) {
    const { skip, take, search, sortBy, sortDir, page, limit } = parsePagination(req, "date");
    const { category, from, to } = req.query as Record<string, string | undefined>;
    const { familyMemberId } = req.query as Record<string, string | undefined>;

    const where: Prisma.ExpenseWhereInput = {
      userId,
      ...(category ? { category: category as never } : {}),
      ...(familyMemberId ? { familyMemberId } : {}),
      ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      ...(search ? { description: { contains: search, mode: "insensitive" } } : {}),
    };

    const allowedSortFields = new Set(["date", "amount", "category", "createdAt"]);
    const orderBy = { [allowedSortFields.has(sortBy ?? "") ? sortBy! : "date"]: sortDir };

    const [items, total] = await Promise.all([
      prisma.expense.findMany({ where, skip, take, orderBy, include: { splits: true, familyMember: { select: { name: true } } } }),
      prisma.expense.count({ where }),
    ]);

    return { items: items.map(serializeExpense), meta: buildPaginationMeta(total, page, limit) };
  },

  async getById(userId: string, id: string) {
    const expense = await prisma.expense.findFirst({
      where: { id, userId },
      include: { splits: true, familyMember: { select: { name: true } } },
    });
    if (!expense) throw AppError.notFound("Expense not found");
    return serializeExpense(expense);
  },

  async create(userId: string, input: CreateExpenseInput) {
    const { splits, ...expenseFields } = input;
    const nextRecurrenceDate = expenseFields.isRecurring && expenseFields.recurrenceInterval
      ? addInterval(expenseFields.date, expenseFields.recurrenceInterval)
      : null;

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: { ...expenseFields, userId, nextRecurrenceDate },
        include: { splits: true, familyMember: { select: { name: true } } },
      });

      if (splits?.length) {
        await tx.expenseSplit.createMany({
          data: splits.map((s) => ({ expenseId: created.id, participantName: s.participantName, amount: s.amount })),
        });
      }

      await tx.transaction.create({
        data: {
          userId,
          type: "EXPENSE",
          amount: expenseFields.amount,
          date: expenseFields.date,
          description: expenseFields.description ?? `${expenseFields.category} expense`,
          category: expenseFields.category,
          bankAccountId: expenseFields.bankAccountId,
        },
      });

      return splits?.length
        ? tx.expense.findUniqueOrThrow({ where: { id: created.id }, include: { splits: true, familyMember: { select: { name: true } } } })
        : created;
    });

    await maybeCreateLargeExpenseAlert(userId, expenseFields.amount, expenseFields.category);
    return serializeExpense(expense);
  },

  async update(userId: string, id: string, input: UpdateExpenseInput) {
    const existing = await prisma.expense.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Expense not found");

    const { splits, ...expenseFields } = input;
    const effectiveDate = expenseFields.date ?? existing.date;
    const effectiveInterval = expenseFields.recurrenceInterval ?? existing.recurrenceInterval;
    const effectiveIsRecurring = expenseFields.isRecurring ?? existing.isRecurring;
    const nextRecurrenceDate =
      effectiveIsRecurring && effectiveInterval ? addInterval(effectiveDate, effectiveInterval) : null;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.expense.update({
        where: { id },
        data: { ...expenseFields, nextRecurrenceDate },
      });

      if (splits) {
        await tx.expenseSplit.deleteMany({ where: { expenseId: id } });
        if (splits.length) {
          await tx.expenseSplit.createMany({
            data: splits.map((s) => ({ expenseId: id, participantName: s.participantName, amount: s.amount })),
          });
        }
      }

      return tx.expense.findUniqueOrThrow({ where: { id }, include: { splits: true, familyMember: { select: { name: true } } } });
    });

    return serializeExpense(updated);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.expense.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Expense not found");
    if (existing.receiptUrl) {
      const filePath = path.join(__dirname, "../../../", existing.receiptUrl.replace(/^\//, ""));
      fs.promises.unlink(filePath).catch(() => undefined);
    }
    await prisma.expense.delete({ where: { id } });
  },

  async uploadReceipt(userId: string, id: string, publicUrl: string) {
    const existing = await prisma.expense.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Expense not found");

    const uploaded = await prisma.expense.update({ where: { id }, data: { receiptUrl: publicUrl } });
    return serializeExpense(uploaded);
  },

  async getSpendingTrends(userId: string, months = 6) {
    const start = new Date();
    start.setMonth(start.getMonth() - (months - 1));
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const expenses = await prisma.expense.findMany({ where: { userId, date: { gte: start } } });

    const byMonth = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const now = new Date();
    const currentMonthKey = monthKey(now);

    expenses.forEach((e) => {
      const key = monthKey(e.date);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(e.amount));
      if (key === currentMonthKey) {
        byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
      }
    });

    const monthly = Array.from(byMonth.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([label, amount]) => ({ label, amount: round2(amount) }));

    const byCategoryList = Array.from(byCategory.entries()).map(([category, amount]) => ({
      category,
      amount: round2(amount),
    }));

    return { monthly, byCategory: byCategoryList };
  },

  async setSplitSettled(userId: string, expenseId: string, splitId: string, isSettled: boolean) {
    const split = await prisma.expenseSplit.findFirst({
      where: { id: splitId, expenseId, expense: { userId } },
    });
    if (!split) throw AppError.notFound("Split not found");

    const updated = await prisma.expenseSplit.update({ where: { id: splitId }, data: { isSettled } });
    return { ...updated, amount: Number(updated.amount) };
  },

  async getSplitsSummary(userId: string) {
    const splits = await prisma.expenseSplit.findMany({
      where: { expense: { userId } },
      include: { expense: { select: { description: true, category: true, date: true } } },
      orderBy: { createdAt: "desc" },
    });

    const byParticipant = new Map<string, { participantName: string; totalOwed: number; unsettledCount: number }>();
    for (const split of splits) {
      if (split.isSettled) continue;
      const entry = byParticipant.get(split.participantName) ?? {
        participantName: split.participantName,
        totalOwed: 0,
        unsettledCount: 0,
      };
      entry.totalOwed = round2(entry.totalOwed + Number(split.amount));
      entry.unsettledCount += 1;
      byParticipant.set(split.participantName, entry);
    }

    return {
      byParticipant: Array.from(byParticipant.values()).sort((a, b) => b.totalOwed - a.totalOwed),
      unsettledSplits: splits
        .filter((s) => !s.isSettled)
        .map((s) => ({
          id: s.id,
          expenseId: s.expenseId,
          participantName: s.participantName,
          amount: Number(s.amount),
          isSettled: s.isSettled,
          expenseDescription: s.expense.description,
          expenseCategory: s.expense.category,
          expenseDate: s.expense.date,
        })),
    };
  },
};

function round2(value: number) {
  return Number(value.toFixed(2));
}
