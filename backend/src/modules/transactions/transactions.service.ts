import { Prisma } from "@prisma/client";
import { Request } from "express";
import ExcelJS from "exceljs";
import { prisma } from "../../config/prisma";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";

function serializeTransaction<T extends Record<string, unknown>>(txn: T) {
  return { ...txn, amount: Number(txn.amount as Prisma.Decimal) };
}

function buildTransactionWhere(userId: string, req: Request): Prisma.TransactionWhereInput {
  const { search } = parsePagination(req, "date");
  const { type, from, to, bankAccountId, category, familyMemberId } = req.query as Record<string, string | undefined>;

  return {
    userId,
    ...(type ? { type: type as never } : {}),
    ...(bankAccountId ? { bankAccountId } : {}),
    ...(category ? { category } : {}),
    ...(familyMemberId ? { familyMemberId } : {}),
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
}

export const transactionsService = {
  async list(userId: string, req: Request) {
    const { skip, take, search, sortBy, sortDir, page, limit } = parsePagination(req, "date");
    const where = buildTransactionWhere(userId, req);

    const allowedSortFields = new Set(["date", "amount", "type", "createdAt"]);
    const orderBy = { [allowedSortFields.has(sortBy ?? "") ? sortBy! : "date"]: sortDir };

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          relatedInvestment: { select: { name: true } },
          bankAccount: { select: { bankName: true } },
          familyMember: { select: { name: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return { items: items.map(serializeTransaction), meta: buildPaginationMeta(total, page, limit) };
  },

  async exportToExcel(userId: string, req: Request): Promise<Buffer> {
    const transactions = await prisma.transaction.findMany({
      where: buildTransactionWhere(userId, req),
      orderBy: { date: "desc" },
      include: {
        relatedInvestment: { select: { name: true } },
        bankAccount: { select: { bankName: true } },
        familyMember: { select: { name: true } },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transactions");
    sheet.columns = [
      { header: "Date", key: "date", width: 14, style: { numFmt: "dd-mmm-yyyy" } },
      { header: "Type", key: "type", width: 20 },
      { header: "Description", key: "description", width: 32 },
      { header: "Category", key: "category", width: 18 },
      { header: "Bank Account", key: "bankAccount", width: 22 },
      { header: "Family Member", key: "familyMember", width: 20 },
      { header: "Amount", key: "amount", width: 14, style: { numFmt: "#,##0.00" } },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    for (const txn of transactions) {
      sheet.addRow({
        date: txn.date,
        type: txn.type,
        description: txn.relatedInvestment?.name ?? txn.description ?? "",
        category: txn.category ?? "",
        bankAccount: txn.bankAccount?.bankName ?? "",
        familyMember: txn.familyMember?.name ?? "",
        amount: Number(txn.amount),
      });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  },

  /**
   * Aggregated totals for the Transactions page summary cards, honoring the same filters as
   * `list()` (minus pagination/type, since the breakdown is itself grouped by type). `TRANSFER`
   * rows are excluded from every bucket — they're internal money movement, not income/expense/
   * investment activity.
   */
  async summary(userId: string, req: Request) {
    const { search } = parsePagination(req, "date");
    const { from, to, bankAccountId, category, familyMemberId } = req.query as Record<string, string | undefined>;

    const where: Prisma.TransactionWhereInput = {
      userId,
      type: { not: "TRANSFER" },
      ...(bankAccountId ? { bankAccountId } : {}),
      ...(category ? { category } : {}),
      ...(familyMemberId ? { familyMemberId } : {}),
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

    const grouped = await prisma.transaction.groupBy({
      by: ["type"],
      where,
      _sum: { amount: true },
    });

    const sumFor = (types: string[]) =>
      grouped.filter((g) => types.includes(g.type)).reduce((acc, g) => acc + Number(g._sum.amount ?? 0), 0);

    const totalIncome = sumFor(["INCOME"]);
    const totalExpense = sumFor(["EXPENSE"]);
    const totalInvestments = sumFor(["INVESTMENT_BUY", "SIP"]) - sumFor(["INVESTMENT_SELL"]);
    const netCashFlow = totalIncome - totalExpense - totalInvestments;

    return { totalIncome, totalExpense, totalInvestments, netCashFlow };
  },

  /** Distinct non-null categories the user has used, for the Transactions page category filter. */
  async categories(userId: string) {
    const rows = await prisma.transaction.findMany({
      where: { userId, category: { not: null } },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    });
    return rows.map((r) => r.category).filter((c): c is string => !!c);
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
