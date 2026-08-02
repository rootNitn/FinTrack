import { InvestmentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import { CreateInvestmentInput, UpdateInvestmentInput } from "./investments.dto";
import { Request } from "express";

function toNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

/** Adds computed `profit` and `roiPercent` fields and converts Decimal fields to plain numbers. */
export function serializeInvestment<T extends Record<string, unknown>>(investment: T) {
  const principal = toNumber(investment.principalAmount as Prisma.Decimal) ?? 0;
  const current = toNumber(investment.currentValue as Prisma.Decimal) ?? 0;
  const profit = current - principal;
  const roiPercent = principal > 0 ? (profit / principal) * 100 : 0;
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
    roiPercent: Number(roiPercent.toFixed(2)),
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
      _sum: { currentValue: true, principalAmount: true },
    });

    return groups
      .map((g) => {
        const totalPrincipal = toNumber(g._sum.principalAmount) ?? 0;
        const totalCurrentValue = toNumber(g._sum.currentValue) ?? 0;
        const totalProfit = totalCurrentValue - totalPrincipal;
        const totalRoiPercent = totalPrincipal > 0 ? (totalProfit / totalPrincipal) * 100 : 0;

        return {
          category: g.category,
          count: g._count._all,
          totalPrincipal: Number(totalPrincipal.toFixed(2)),
          totalCurrentValue: Number(totalCurrentValue.toFixed(2)),
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
    const investment = await prisma.$transaction(async (tx) => {
      if (input.goalId) {
        const goal = await tx.goal.findFirst({ where: { id: input.goalId, userId } });
        if (!goal) throw AppError.notFound("Goal not found");
      }

      const created = await tx.investment.create({ data: { ...input, userId } });
      await tx.transaction.create({
        data: {
          userId,
          type: "INVESTMENT_BUY",
          amount: input.principalAmount,
          date: input.purchaseDate,
          description: `Purchased ${input.name}`,
          category: input.category,
          relatedInvestmentId: created.id,
        },
      });

      if (input.goalId) {
        await tx.goal.update({ where: { id: input.goalId }, data: { currentAmount: { increment: input.principalAmount } } });
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
        data: input,
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

      return result;
    });
    return serializeInvestment(updated);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.investment.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Investment not found");

    await prisma.$transaction(async (tx) => {
      await tx.investment.delete({ where: { id } });
      if (existing.goalId) {
        await tx.goal.update({ where: { id: existing.goalId }, data: { currentAmount: { decrement: Number(existing.principalAmount) } } });
      }
    });
  },

  async bulkDelete(userId: string, ids: string[]) {
    const result = await prisma.investment.deleteMany({ where: { id: { in: ids }, userId } });
    return { deletedCount: result.count };
  },

  async getAllForUser(userId: string) {
    const investments = await prisma.investment.findMany({ where: { userId } });
    return investments.map(serializeInvestment);
  },
};
