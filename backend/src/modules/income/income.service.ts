import { Prisma, RecurrenceInterval } from "@prisma/client";
import { Request } from "express";
import ExcelJS from "exceljs";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import { adjustBankAccountBalance } from "../../utils/bank-account-balance.util";
import { addRecurrenceInterval } from "../../utils/recurrence.util";
import { dayRange } from "../../utils/duplicate-detection.util";
import { CreateIncomeInput, UpdateIncomeInput } from "./income.dto";

function serializeIncome<T extends Record<string, unknown>>(income: T) {
  return { ...income, amount: Number(income.amount as Prisma.Decimal) };
}

function buildIncomeWhere(userId: string, req: Request): Prisma.IncomeWhereInput {
  const { search } = parsePagination(req, "date");
  const { source, bankAccountId, familyMemberId, from, to } = req.query as Record<string, string | undefined>;

  return {
    userId,
    ...(source ? { source: source as never } : {}),
    ...(bankAccountId ? { bankAccountId } : {}),
    ...(familyMemberId ? { familyMemberId } : {}),
    ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    ...(search ? { description: { contains: search, mode: "insensitive" } } : {}),
  };
}

export const incomeService = {
  async list(userId: string, req: Request) {
    const { skip, take, sortBy, sortDir, page, limit } = parsePagination(req, "date");
    const where = buildIncomeWhere(userId, req);

    const allowedSortFields = new Set(["date", "amount", "source", "createdAt"]);
    const orderBy = { [allowedSortFields.has(sortBy ?? "") ? sortBy! : "date"]: sortDir };

    const [items, total] = await Promise.all([
      prisma.income.findMany({
        where,
        skip,
        take,
        orderBy,
        include: { familyMember: { select: { name: true } }, bankAccount: { select: { bankName: true } } },
      }),
      prisma.income.count({ where }),
    ]);

    return { items: items.map(serializeIncome), meta: buildPaginationMeta(total, page, limit) };
  },

  async summary(userId: string, req: Request) {
    const { source, bankAccountId, familyMemberId, from, to, search } = req.query as Record<string, string | undefined>;

    const where: Prisma.IncomeWhereInput = {
      userId,
      ...(source ? { source: source as never } : {}),
      ...(bankAccountId ? { bankAccountId } : {}),
      ...(familyMemberId ? { familyMemberId } : {}),
      ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      ...(search ? { description: { contains: search, mode: "insensitive" } } : {}),
    };

    const grouped = await prisma.income.groupBy({ by: ["source"], where, _sum: { amount: true } });

    const amountFor = (source: string) =>
      grouped.filter((g) => g.source === source).reduce((sum, g) => sum + Number(g._sum.amount ?? 0), 0);
    const totalIncome = grouped.reduce((sum, g) => sum + Number(g._sum.amount ?? 0), 0);
    const salary = amountFor("SALARY");
    const interest = amountFor("INTEREST");
    const other = totalIncome - salary - interest;

    return { totalIncome, salary, interest, other };
  },

  async getById(userId: string, id: string) {
    const income = await prisma.income.findFirst({ where: { id, userId } });
    if (!income) throw AppError.notFound("Income not found");
    return serializeIncome(income);
  },

  async create(userId: string, input: CreateIncomeInput) {
    const { force, ...incomeFields } = input;

    if (!force) {
      const { gte, lt } = dayRange(incomeFields.date);
      const duplicate = await prisma.income.findFirst({
        where: { userId, date: { gte, lt }, amount: incomeFields.amount, source: incomeFields.source },
        orderBy: { createdAt: "desc" },
      });
      if (duplicate) {
        throw AppError.conflict(
          `A ${incomeFields.source} income entry of ${incomeFields.amount} on ${incomeFields.date.toDateString()} already exists. Add it again anyway?`,
          { duplicate: serializeIncome(duplicate) }
        );
      }
    }

    const nextRecurrenceDate =
      incomeFields.isRecurring && incomeFields.recurrenceInterval ? addRecurrenceInterval(incomeFields.date, incomeFields.recurrenceInterval) : null;

    const income = await prisma.$transaction(async (tx) => {
      const created = await tx.income.create({ data: { ...incomeFields, userId, nextRecurrenceDate } });
      await tx.transaction.create({
        data: {
          userId,
          type: "INCOME",
          sourceType: "INCOME",
          sourceId: created.id,
          amount: incomeFields.amount,
          date: incomeFields.date,
          description: incomeFields.description ?? `${incomeFields.source} income`,
          category: incomeFields.source,
          bankAccountId: incomeFields.bankAccountId,
          familyMemberId: incomeFields.familyMemberId,
        },
      });

      // Income increases the linked bank account's balance (no-op if not linked to one).
      await adjustBankAccountBalance(tx, incomeFields.bankAccountId, incomeFields.amount);

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
      effectiveIsRecurring && effectiveInterval ? addRecurrenceInterval(effectiveDate, effectiveInterval) : null;

    const updated = await prisma.$transaction(async (tx) => {
      // Reverse the old amount's effect on its (possibly different) bank account, then apply the
      // new amount to whichever account is now linked — a no-op for either side that has none.
      const newBankAccountId = input.bankAccountId !== undefined ? input.bankAccountId : existing.bankAccountId;
      const newAmount = input.amount !== undefined ? input.amount : Number(existing.amount);
      await adjustBankAccountBalance(tx, existing.bankAccountId, -Number(existing.amount));
      await adjustBankAccountBalance(tx, newBankAccountId, newAmount);

      const result = await tx.income.update({ where: { id }, data: { ...input, nextRecurrenceDate } });
      await tx.transaction.updateMany({
        where: { userId, sourceType: "INCOME", sourceId: id },
        data: {
          amount: result.amount,
          date: result.date,
          description: result.description ?? `${result.source} income`,
          category: result.source,
          bankAccountId: result.bankAccountId,
          familyMemberId: result.familyMemberId,
        },
      });
      return result;
    });
    return serializeIncome(updated);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.income.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Income not found");
    await prisma.$transaction(async (tx) => {
      // Deleting the income reverses its effect on the linked bank account's balance.
      await adjustBankAccountBalance(tx, existing.bankAccountId, -Number(existing.amount));
      await tx.transaction.deleteMany({ where: { userId, sourceType: "INCOME", sourceId: id } });
      await tx.income.delete({ where: { id } });
    });
  },

  /** Exports the SAME filtered set the list endpoint would return (source/date range/search/bank/family member). */
  async exportToExcel(userId: string, req: Request): Promise<Buffer> {
    const where = buildIncomeWhere(userId, req);
    const entries = await prisma.income.findMany({
      where,
      orderBy: { date: "desc" },
      include: { familyMember: { select: { name: true } }, bankAccount: { select: { bankName: true } } },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Income");
    sheet.columns = [
      { header: "Date", key: "date", width: 14, style: { numFmt: "dd-mmm-yyyy" } },
      { header: "Source", key: "source", width: 16 },
      { header: "Amount", key: "amount", width: 14, style: { numFmt: "#,##0.00" } },
      { header: "Bank Account", key: "bankAccount", width: 20 },
      { header: "Description", key: "description", width: 32 },
      { header: "Family Member", key: "familyMember", width: 18 },
      { header: "Recurring", key: "isRecurring", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    for (const entry of entries) {
      sheet.addRow({
        date: entry.date,
        source: entry.source,
        amount: Number(entry.amount),
        bankAccount: entry.bankAccount?.bankName ?? "",
        description: entry.description ?? "",
        familyMember: entry.familyMember?.name ?? "",
        isRecurring: entry.isRecurring ? "Yes" : "No",
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },
};
