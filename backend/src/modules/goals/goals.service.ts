import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { isNotificationEnabled } from "../../utils/notification-preferences";
import { CreateGoalInput, UpdateGoalInput } from "./goals.dto";

function serializeGoal<T extends Record<string, unknown>>(goal: T) {
  const target = Number(goal.targetAmount as Prisma.Decimal);
  const current = Number(goal.currentAmount as Prisma.Decimal);
  const progressPercent = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const remainingAmount = Math.max(0, target - current);
  const familyMember = goal.familyMember as { name: string } | null | undefined;

  return {
    ...goal,
    targetAmount: target,
    currentAmount: current,
    progressPercent: Number(progressPercent.toFixed(2)),
    remainingAmount: Number(remainingAmount.toFixed(2)),
    familyMemberName: familyMember?.name ?? null,
    familyMember: undefined,
  };
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
    return goals.map(serializeGoal);
  },

  async upcoming(userId: string, take = 5) {
    const goals = await prisma.goal.findMany({
      where: { userId, deadline: { gte: new Date() } },
      orderBy: { deadline: "asc" },
      take,
      include: { familyMember: { select: { name: true } } },
    });
    return goals.map(serializeGoal);
  },

  async getById(userId: string, id: string) {
    const goal = await prisma.goal.findFirst({
      where: { id, userId },
      include: { familyMember: { select: { name: true } } },
    });
    if (!goal) throw AppError.notFound("Goal not found");
    return serializeGoal(goal);
  },

  async create(userId: string, input: CreateGoalInput) {
    const goal = await prisma.goal.create({
      data: { ...input, userId },
      include: { familyMember: { select: { name: true } } },
    });
    await checkGoalAchievement(userId, goal.id, goal.name, input.currentAmount, input.targetAmount);
    return serializeGoal(goal);
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
    return serializeGoal(goal);
  },

  async addContribution(userId: string, id: string, amount: number) {
    const existing = await prisma.goal.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Goal not found");

    const goal = await prisma.goal.update({
      where: { id },
      data: { currentAmount: { increment: amount } },
      include: { familyMember: { select: { name: true } } },
    });
    await checkGoalAchievement(userId, goal.id, goal.name, Number(goal.currentAmount), Number(goal.targetAmount));
    return serializeGoal(goal);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.goal.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Goal not found");
    await prisma.goal.delete({ where: { id } });
  },
};
