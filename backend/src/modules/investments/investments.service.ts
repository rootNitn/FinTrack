import { InvestmentStatus, Prisma, RecurrenceInterval } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import { computeRoiPercent } from "../../utils/finance-calculations.util";
import { CreateInvestmentInput, UpdateInvestmentInput } from "./investments.dto";
import { Request } from "express";
import { calculateFd, TenureUnit } from "../fd/fd-calculation.util";

function toNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function addInterval(date: Date, interval: RecurrenceInterval): Date {
  const next = new Date(date);
  if (interval === "WEEKLY") next.setDate(next.getDate() + 7);
  else if (interval === "MONTHLY") next.setMonth(next.getMonth() + 1);
  else if (interval === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  return next;
}

/** Adds computed `profit` and `roiPercent` fields and converts Decimal fields to plain numbers. */
export function serializeInvestment<T extends Record<string, unknown>>(investment: T) {
  const principal = toNumber(investment.principalAmount as Prisma.Decimal) ?? 0;
  const current = toNumber(investment.currentValue as Prisma.Decimal) ?? 0;
  const profit = current - principal;
  const roiPercent = computeRoiPercent(principal, current);
  const goal = investment.goal as { name: string } | null | undefined;
  const familyMember = investment.familyMember as { name: string } | null | undefined;

  return {
    ...investment,
    principalAmount: principal,
    currentValue: current,
    targetValue: toNumber(investment.targetValue as Prisma.Decimal),
    sipAmount: toNumber(investment.sipAmount as Prisma.Decimal),
    units: toNumber(investment.units as Prisma.Decimal),
    currentNav: toNumber(investment.currentNav as Prisma.Decimal),
    exchangeRate: toNumber(investment.exchangeRate as Prisma.Decimal) ?? 1,
    profit: Number(profit.toFixed(2)),
    roiPercent,
    goalName: goal?.name ?? null,
    goal: undefined,
    familyMemberName: familyMember?.name ?? null,
    familyMember: undefined,
  };
}

export const investmentsService = {
  async list(userId: string, req: Request) {
    const { skip, take, search, sortBy, sortDir, page, limit } = parsePagination(req, "purchaseDate");
    const { category, status, riskLevel } = req.query as Record<string, string | undefined>;
    const { familyMemberId } = req.query as Record<string, string | undefined>;

    const where: Prisma.InvestmentWhereInput = {
      userId,
      ...(category ? { category: category as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(riskLevel ? { riskLevel: riskLevel as never } : {}),
      ...(familyMemberId ? { familyMemberId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { account: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const allowedSortFields = new Set([
      "name",
      "category",
      "principalAmount",
      "currentValue",
      "purchaseDate",
      "status",
      "riskLevel",
      "createdAt",
    ]);
    const orderBy = { [allowedSortFields.has(sortBy ?? "") ? sortBy! : "purchaseDate"]: sortDir };

    const [items, total] = await Promise.all([
      prisma.investment.findMany({
        where,
        skip,
        take,
        orderBy,
        include: { goal: { select: { name: true } }, familyMember: { select: { name: true } } },
      }),
      prisma.investment.count({ where }),
    ]);

    return { items: items.map(serializeInvestment), meta: buildPaginationMeta(total, page, limit) };
  },

  async getCategorySummary(userId: string) {
    // Only ACTIVE holdings count toward "current value" — SOLD/MATURED/CLOSED investments
    // (e.g. redemption rows from a broker import) shouldn't inflate the live portfolio total.
    const groups = await prisma.investment.groupBy({
      by: ["category"],
      where: { userId, status: InvestmentStatus.ACTIVE },
      _count: { _all: true },
      _sum: { currentValue: true, principalAmount: true, targetValue: true },
    });

    return groups
      .map((g) => {
        const totalPrincipal = toNumber(g._sum.principalAmount) ?? 0;
        const totalCurrentValue = toNumber(g._sum.currentValue) ?? 0;
        const totalTargetValue = toNumber(g._sum.targetValue) ?? 0;
        const totalProfit = totalCurrentValue - totalPrincipal;
        const totalRoiPercent = totalPrincipal > 0 ? (totalProfit / totalPrincipal) * 100 : 0;

        return {
          category: g.category,
          count: g._count._all,
          totalPrincipal: Number(totalPrincipal.toFixed(2)),
          totalCurrentValue: Number(totalCurrentValue.toFixed(2)),
          totalTargetValue: Number(totalTargetValue.toFixed(2)),
          totalProfit: Number(totalProfit.toFixed(2)),
          totalRoiPercent: Number(totalRoiPercent.toFixed(2)),
        };
      })
      .sort((a, b) => b.count - a.count);
  },

  async getById(userId: string, id: string) {
    const investment = await prisma.investment.findFirst({
      where: { id, userId },
      include: { goal: { select: { name: true } }, familyMember: { select: { name: true } } },
    });
    if (!investment) throw AppError.notFound("Investment not found");
    return serializeInvestment(investment);
  },

  async create(userId: string, input: CreateInvestmentInput) {
    const fdResult = input.category === "FIXED_DEPOSIT" ? calculateFd({ principal: input.principalAmount, annualRatePercent: input.fdInterestRate!, tenureValue: input.fdTenureValue!, tenureUnit: input.fdTenureUnit! as TenureUnit, depositType: input.fdDepositType!, compounding: input.fdCompounding!, startDate: input.purchaseDate }) : null;
    const investmentInput = fdResult ? { ...input, currentValue: fdResult.maturityAmount, maturityDate: new Date(fdResult.maturityDate), fdMaturityAmount: fdResult.maturityAmount } : input;
    const nextRecurrenceDate =
      input.isRecurring && input.recurrenceInterval ? addInterval(input.purchaseDate, input.recurrenceInterval) : null;

    const investment = await prisma.$transaction(async (tx) => {
      if (input.goalId) {
        const goal = await tx.goal.findFirst({ where: { id: input.goalId, userId } });
        if (!goal) throw AppError.notFound("Goal not found");
      }

      const created = await tx.investment.create({ data: { ...investmentInput, userId, nextRecurrenceDate } });
      await tx.transaction.create({
        data: {
          userId,
          type: "INVESTMENT_BUY",
          amount: investmentInput.principalAmount,
          date: investmentInput.purchaseDate,
          description: `Purchased ${investmentInput.name}`,
          category: investmentInput.category,
          relatedInvestmentId: created.id,
          familyMemberId: input.familyMemberId,
        },
      });

      if (investmentInput.goalId) {
        await tx.goal.update({ where: { id: investmentInput.goalId }, data: { currentAmount: { increment: investmentInput.principalAmount } } });
      }

      return tx.investment.findUniqueOrThrow({
        where: { id: created.id },
        include: { goal: { select: { name: true } }, familyMember: { select: { name: true } } },
      });
    });
    return serializeInvestment(investment);
  },

  async update(userId: string, id: string, input: UpdateInvestmentInput) {
    const existing = await prisma.investment.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Investment not found");

    const effectiveDate = input.purchaseDate ?? existing.purchaseDate;
    const effectiveInterval = input.recurrenceInterval ?? existing.recurrenceInterval;
    const effectiveIsRecurring = input.isRecurring ?? existing.isRecurring;
    const nextRecurrenceDate =
      effectiveIsRecurring && effectiveInterval ? addInterval(effectiveDate, effectiveInterval) : null;
    const effectiveCategory = input.category ?? existing.category;
    let fdResult = null;
    if (effectiveCategory === "FIXED_DEPOSIT") {
      const fdTenureValue = input.fdTenureValue ?? Number(existing.fdTenureValue);
      const fdTenureUnit = input.fdTenureUnit ?? existing.fdTenureUnit;
      const fdInterestRate = input.fdInterestRate ?? Number(existing.fdInterestRate);
      const fdDepositType = input.fdDepositType ?? existing.fdDepositType;
      const fdCompounding = input.fdCompounding ?? existing.fdCompounding;
      if (!fdTenureValue || !fdTenureUnit || !fdInterestRate || !fdDepositType || !fdCompounding) {
        throw AppError.badRequest("Complete Fixed Deposit details are required");
      }
      fdResult = calculateFd({
        principal: input.principalAmount ?? Number(existing.principalAmount),
        annualRatePercent: fdInterestRate,
        tenureValue: fdTenureValue,
        tenureUnit: fdTenureUnit as TenureUnit,
        depositType: fdDepositType,
        compounding: fdCompounding,
        startDate: effectiveDate,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const oldGoalId = existing.goalId;
      const oldPrincipal = Number(existing.principalAmount);
      const newGoalId = input.goalId !== undefined ? input.goalId : oldGoalId;
      const newPrincipal = input.principalAmount !== undefined ? input.principalAmount : oldPrincipal;

      if (newGoalId && newGoalId !== oldGoalId) {
        const goal = await tx.goal.findFirst({ where: { id: newGoalId, userId } });
        if (!goal) throw AppError.notFound("Goal not found");
      }

      const result = await tx.investment.update({
        where: { id },
        data: {
          ...input,
          ...(fdResult ? { currentValue: fdResult.maturityAmount, maturityDate: new Date(fdResult.maturityDate), fdMaturityAmount: fdResult.maturityAmount } : {}),
          nextRecurrenceDate,
        },
        include: { goal: { select: { name: true } }, familyMember: { select: { name: true } } },
      });

      if (oldGoalId && oldGoalId !== newGoalId) {
        // Investment unlinked from its old goal (or moved to a different one) — remove its contribution.
        await tx.goal.update({ where: { id: oldGoalId }, data: { currentAmount: { decrement: oldPrincipal } } });
      }

      if (newGoalId && newGoalId !== oldGoalId) {
        // Investment newly linked (or moved) to this goal — add its contribution.
        await tx.goal.update({ where: { id: newGoalId }, data: { currentAmount: { increment: newPrincipal } } });
      } else if (newGoalId && newGoalId === oldGoalId && newPrincipal !== oldPrincipal) {
        // Same goal, but the invested amount changed — adjust by the delta.
        await tx.goal.update({ where: { id: newGoalId }, data: { currentAmount: { increment: newPrincipal - oldPrincipal } } });
      }

      await tx.transaction.updateMany({
        where: { userId, type: "INVESTMENT_BUY", relatedInvestmentId: id },
        data: {
          amount: result.principalAmount,
          date: result.purchaseDate,
          description: `Purchased ${result.name}`,
          category: result.category,
          familyMemberId: result.familyMemberId,
        },
      });

      return result;
    });
    return serializeInvestment(updated);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.investment.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Investment not found");

    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { userId, type: "INVESTMENT_BUY", relatedInvestmentId: id } });
      await tx.investment.delete({ where: { id } });
      if (existing.goalId) {
        await tx.goal.update({ where: { id: existing.goalId }, data: { currentAmount: { decrement: Number(existing.principalAmount) } } });
      }
    });
  },

  async bulkDelete(userId: string, ids: string[]) {
    return prisma.$transaction(async (tx) => {
      const owned = await tx.investment.findMany({ where: { id: { in: ids }, userId }, select: { id: true } });
      const ownedIds = owned.map((investment) => investment.id);
      if (!ownedIds.length) return { deletedCount: 0 };
      await tx.transaction.deleteMany({ where: { userId, type: "INVESTMENT_BUY", relatedInvestmentId: { in: ownedIds } } });
      const result = await tx.investment.deleteMany({ where: { id: { in: ownedIds }, userId } });
      return { deletedCount: result.count };
    });
  },

  async getAllForUser(userId: string) {
    const investments = await prisma.investment.findMany({ where: { userId } });
    return investments.map(serializeInvestment);
  },
};
