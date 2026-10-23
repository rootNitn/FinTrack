import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { isNotificationEnabled } from "../../utils/notification-preferences";
import { computeGoalProgress, computeRequiredSip } from "../../utils/finance-calculations.util";
import { CreateGoalInput, UpdateGoalInput } from "./goals.dto";

function serializeGoal<T extends Record<string, unknown>>(goal: T) {
  const target = Number(goal.targetAmount as Prisma.Decimal);
  const current = Number(goal.currentAmount as Prisma.Decimal);
  const { progressPercent, remainingAmount } = computeGoalProgress(current, target);
  const familyMember = goal.familyMember as { name: string } | null | undefined;
  const projectedCompletionDate = goal.projectedCompletionDate as string | null | undefined;
  const requiredMonthlyContribution = goal.requiredMonthlyContribution as number | null | undefined;
  const status = goal.status as string | undefined;
  const expectedReturnPercent = goal.expectedReturnPercent as Prisma.Decimal | null | undefined;

  return {
    ...goal,
    targetAmount: target,
    currentAmount: current,
    progressPercent,
    remainingAmount,
    familyMemberName: familyMember?.name ?? null,
    projectedCompletionDate: projectedCompletionDate ?? null,
    requiredMonthlyContribution: requiredMonthlyContribution ?? null,
    expectedReturnPercent: expectedReturnPercent !== null && expectedReturnPercent !== undefined ? Number(expectedReturnPercent) : null,
    status: status ?? null,
    familyMember: undefined,
  };
}

function goalProjection(
  current: number,
  target: number,
  deadline: Date,
  contributions: { amount: Prisma.Decimal; date: Date }[],
  expectedReturnPercent = 0
) {
  const remaining = Math.max(0, target - current);
  const monthsToDeadline = Math.max(1, (deadline.getTime() - Date.now()) / (30.44 * 24 * 60 * 60 * 1000));
  const requiredMonthlyContribution =
    remaining > 0 && deadline.getTime() > Date.now()
      ? computeRequiredSip(current, target, Math.ceil(monthsToDeadline), expectedReturnPercent)
      : null;
  let projectedCompletionDate: string | null = null;
  const recent = contributions.filter((contribution) => contribution.date >= new Date(Date.now() - 183 * 24 * 60 * 60 * 1000));
  if (current < target && recent.length > 0) {
    const total = recent.reduce((sum, contribution) => sum + Number(contribution.amount), 0);
    const firstDate = recent[0].date.getTime();
    const months = Math.max((Date.now() - firstDate) / (30.44 * 24 * 60 * 60 * 1000), 1);
    const monthlyAmount = total / months;
    if (monthlyAmount > 0) {
      const projected = new Date();
      projected.setDate(projected.getDate() + Math.ceil((remaining / monthlyAmount) * 30.44));
      projectedCompletionDate = projected.toISOString();
    }
  }
  let status: "ACHIEVED" | "ON_TRACK" | "AT_RISK" | "BEHIND" | "OVERDUE";
  if (current >= target) status = "ACHIEVED";
  else if (deadline.getTime() <= Date.now()) status = "OVERDUE";
  else if (!projectedCompletionDate) status = "BEHIND";
  else if (new Date(projectedCompletionDate) > deadline) status = "AT_RISK";
  else status = "ON_TRACK";
  return { projectedCompletionDate, requiredMonthlyContribution, status };
}

async function checkGoalAchievement(userId: string, goalId: string, name: string, current: number, target: number) {
  if (current >= target) {
    if (!(await isNotificationEnabled(userId, "goalAchievement"))) return;

    const alreadyNotified = await prisma.notification.findFirst({
      where: { userId, type: "GOAL_ACHIEVEMENT", meta: { path: ["goalId"], equals: goalId } },
    });
    if (!alreadyNotified) {
      await prisma.notification.create({
        data: {
          userId,
          type: "GOAL_ACHIEVEMENT",
          title: "Goal achieved! 🎉",
          message: `You've reached your target for "${name}".`,
          meta: { goalId },
        },
      });
    }
  }
}

export const goalsService = {
  async list(userId: string, familyMemberId?: string) {
    const goals = await prisma.goal.findMany({
      where: { userId, ...(familyMemberId ? { familyMemberId } : {}) },
      orderBy: { deadline: "asc" },
      include: { familyMember: { select: { name: true } } },
    });
    const contributions = await prisma.goalContribution.findMany({
      where: { userId, goalId: { in: goals.map((goal) => goal.id) } },
      orderBy: { date: "asc" },
    });
    return goals.map((goal) => serializeGoal({
      ...goal,
      ...goalProjection(
        Number(goal.currentAmount),
        Number(goal.targetAmount),
        goal.deadline,
        contributions.filter((contribution) => contribution.goalId === goal.id),
        goal.expectedReturnPercent !== null ? Number(goal.expectedReturnPercent) : 0
      ),
    }));
  },

  async upcoming(userId: string, take = 5) {
    const goals = await prisma.goal.findMany({
      where: { userId, deadline: { gte: new Date() } },
      orderBy: { deadline: "asc" },
      take,
      include: { familyMember: { select: { name: true } } },
    });
    const contributions = await prisma.goalContribution.findMany({
      where: { userId, goalId: { in: goals.map((goal) => goal.id) } },
      orderBy: { date: "asc" },
    });
    return goals.map((goal) => serializeGoal({
      ...goal,
      ...goalProjection(
        Number(goal.currentAmount),
        Number(goal.targetAmount),
        goal.deadline,
        contributions.filter((contribution) => contribution.goalId === goal.id),
        goal.expectedReturnPercent !== null ? Number(goal.expectedReturnPercent) : 0
      ),
    }));
  },

  async getById(userId: string, id: string) {
    const goal = await prisma.goal.findFirst({
      where: { id, userId },
      include: { familyMember: { select: { name: true } } },
    });
    if (!goal) throw AppError.notFound("Goal not found");
    const contributions = await prisma.goalContribution.findMany({ where: { goalId: id, userId }, orderBy: { date: "asc" } });
    return serializeGoal({
      ...goal,
      ...goalProjection(
        Number(goal.currentAmount),
        Number(goal.targetAmount),
        goal.deadline,
        contributions,
        goal.expectedReturnPercent !== null ? Number(goal.expectedReturnPercent) : 0
      ),
    });
  },

  async create(userId: string, input: CreateGoalInput) {
    const goal = await prisma.goal.create({
      data: { ...input, userId },
      include: { familyMember: { select: { name: true } } },
    });
    await checkGoalAchievement(userId, goal.id, goal.name, input.currentAmount, input.targetAmount);
    return serializeGoal({
      ...goal,
      ...goalProjection(input.currentAmount, input.targetAmount, input.deadline, [], input.expectedReturnPercent ?? 0),
    });
  },

  async update(userId: string, id: string, input: UpdateGoalInput) {
    const existing = await prisma.goal.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Goal not found");

    const goal = await prisma.goal.update({
      where: { id },
      data: input,
      include: { familyMember: { select: { name: true } } },
    });
    await checkGoalAchievement(
      userId,
      goal.id,
      goal.name,
      Number(goal.currentAmount),
      Number(goal.targetAmount)
    );
    const contributions = await prisma.goalContribution.findMany({ where: { goalId: id, userId }, orderBy: { date: "asc" } });
    return serializeGoal({
      ...goal,
      ...goalProjection(
        Number(goal.currentAmount),
        Number(goal.targetAmount),
        goal.deadline,
        contributions,
        goal.expectedReturnPercent !== null ? Number(goal.expectedReturnPercent) : 0
      ),
    });
  },

  async addContribution(userId: string, id: string, input: { amount: number; date?: Date; note?: string }) {
    const existing = await prisma.goal.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Goal not found");

    const goal = await prisma.$transaction(async (tx) => {
      await tx.goalContribution.create({ data: { goalId: id, userId, amount: input.amount, date: input.date, note: input.note } });
      return tx.goal.update({
        where: { id },
        data: { currentAmount: { increment: input.amount } },
        include: { familyMember: { select: { name: true } } },
      });
    });
    await checkGoalAchievement(userId, goal.id, goal.name, Number(goal.currentAmount), Number(goal.targetAmount));
    const contributions = await prisma.goalContribution.findMany({ where: { goalId: id, userId }, orderBy: { date: "asc" } });
    return serializeGoal({
      ...goal,
      ...goalProjection(
        Number(goal.currentAmount),
        Number(goal.targetAmount),
        goal.deadline,
        contributions,
        goal.expectedReturnPercent !== null ? Number(goal.expectedReturnPercent) : 0
      ),
    });
  },

  async contributions(userId: string, id: string) {
    const goal = await prisma.goal.findFirst({ where: { id, userId } });
    if (!goal) throw AppError.notFound("Goal not found");
    const contributions = await prisma.goalContribution.findMany({ where: { goalId: id, userId }, orderBy: { date: "desc" } });
    return contributions.map((contribution) => ({ ...contribution, amount: Number(contribution.amount) }));
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.goal.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Goal not found");
    await prisma.goal.delete({ where: { id } });
  },
};
