import { Prisma } from "@prisma/client";
import { Request } from "express";
import { prisma } from "../../config/prisma";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";

function serializeTransaction<T extends Record<string, unknown>>(txn: T) {
  return { ...txn, amount: Number(txn.amount as Prisma.Decimal) };
}

export const transactionsService = {
  async list(userId: string, req: Request) {
    const { skip, take, search, sortBy, sortDir, page, limit } = parsePagination(req, "date");
    const { type, from, to } = req.query as Record<string, string | undefined>;

    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(type ? { type: type as never } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(search ? { description: { contains: search, mode: "insensitive" } } : {}),
    };

    const allowedSortFields = new Set(["date", "amount", "type", "createdAt"]);
    const orderBy = { [allowedSortFields.has(sortBy ?? "") ? sortBy! : "date"]: sortDir };

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy,
        include: { relatedInvestment: { select: { name: true } }, bankAccount: { select: { bankName: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);

    return { items: items.map(serializeTransaction), meta: buildPaginationMeta(total, page, limit) };
  },

  async recent(userId: string, take = 8) {
    const items = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take,
    });
    return items.map(serializeTransaction);
  },
};
