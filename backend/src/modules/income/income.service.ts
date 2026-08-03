import { Prisma, RecurrenceInterval } from "@prisma/client";
import { Request } from "express";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import { CreateIncomeInput, UpdateIncomeInput } from "./income.dto";

function serializeIncome<T extends Record<string, unknown>>(income: T) {
  return { ...income, amount: Number(income.amount as Prisma.Decimal) };
}

function addInterval(date: Date, interval: RecurrenceInterval): Date {
  const next = new Date(date);
  if (interval === "WEEKLY") next.setDate(next.getDate() + 7);
  else if (interval === "MONTHLY") next.setMonth(next.getMonth() + 1);
  else if (interval === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  return next;
}

export const incomeService = {
  async list(userId: string, req: Request) {
    const { skip, take, search, sortBy, sortDir, page, limit } = parsePagination(req, "date");
    const { source, from, to } = req.query as Record<string, string | undefined>;

    const where: Prisma.IncomeWhereInput = {
      userId,
      ...(source ? { source: source as never } : {}),
      ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      ...(search ? { description: { contains: search, mode: "insensitive" } } : {}),
    };

    const allowedSortFields = new Set(["date", "amount", "source", "createdAt"]);
    const orderBy = { [allowedSortFields.has(sortBy ?? "") ? sortBy! : "date"]: sortDir };

    const [items, total] = await Promise.all([
      prisma.income.findMany({ where, skip, take, orderBy }),
      prisma.income.count({ where }),
    ]);

    return { items: items.map(serializeIncome), meta: buildPaginationMeta(total, page, limit) };
  },

  async getById(userId: string, id: string) {
    const income = await prisma.income.findFirst({ where: { id, userId } });
    if (!income) throw AppError.notFound("Income not found");
    return serializeIncome(income);
  },

  async create(userId: string, input: CreateIncomeInput) {
    const nextRecurrenceDate =
      input.isRecurring && input.recurrenceInterval ? addInterval(input.date, input.recurrenceInterval) : null;

    const income = await prisma.$transaction(async (tx) => {
      const created = await tx.income.create({ data: { ...input, userId, nextRecurrenceDate } });
      await tx.transaction.create({
        data: {
          userId,
          type: "INCOME",
          amount: input.amount,
          date: input.date,
          description: input.description ?? `${input.source} income`,
          category: input.source,
          bankAccountId: input.bankAccountId,
        },
      });
      return created;
    });
    return serializeIncome(income);
  },

  async update(userId: string, id: string, input: UpdateIncomeInput) {
    const existing = await prisma.income.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Income not found");

    const effectiveDate = input.date ?? existing.date;
    const effectiveInterval = input.recurrenceInterval ?? existing.recurrenceInterval;
    const effectiveIsRecurring = input.isRecurring ?? existing.isRecurring;
    const nextRecurrenceDate =
      effectiveIsRecurring && effectiveInterval ? addInterval(effectiveDate, effectiveInterval) : null;

    const updated = await prisma.income.update({ where: { id }, data: { ...input, nextRecurrenceDate } });
    return serializeIncome(updated);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.income.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Income not found");
    await prisma.income.delete({ where: { id } });
  },
};
