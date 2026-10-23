import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateHealthGoalInput, UpdateHealthGoalInput } from "./health-goals.dto";
import { syncGoalOnCreate } from "./health-goal-sync.util";

function serialize<T extends Record<string, unknown>>(goal: T) {
  const target = Number(goal.targetValue as Prisma.Decimal);
  const current = Number(goal.currentValue as Prisma.Decimal);
  const achieved = goal.achievedAt != null;
  // WEIGHT_TARGET is target-seeking (weight can be above OR below target), unlike the other
  // accumulation-style goals where "more is better" — so `current/target` would misleadingly
  // read >=100% long before the target weight is actually reached. Use closeness-to-target instead.
  const progressPercent =
    goal.type === "WEIGHT_TARGET"
      ? achieved
        ? 100
        : current > 0 && target > 0
          ? Math.min(99, (Math.min(current, target) / Math.max(current, target)) * 100)
          : 0
      : target > 0
        ? Math.min(100, (current / target) * 100)
        : 0;
  return {
    ...goal,
    targetValue: target,
    currentValue: current,
    progressPercent: Number(progressPercent.toFixed(2)),
  };
}

export const healthGoalsService = {
  async list(userId: string) {
    const goals = await prisma.healthGoal.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return goals.map(serialize);
  },

  async getById(userId: string, id: string) {
    const goal = await prisma.healthGoal.findFirst({ where: { id, userId } });
    if (!goal) throw AppError.notFound("Health goal not found");
    return serialize(goal);
  },

  async create(userId: string, input: CreateHealthGoalInput) {
    const existing = await prisma.healthGoal.findFirst({ where: { userId, type: input.type } });
    if (existing) throw AppError.conflict(`A goal for ${input.type} already exists`);

    const goal = await prisma.healthGoal.create({ data: { ...input, userId } });
    await syncGoalOnCreate(userId, input.type);
    const refreshed = await prisma.healthGoal.findUniqueOrThrow({ where: { id: goal.id } });
    return serialize(refreshed);
  },

  async update(userId: string, id: string, input: UpdateHealthGoalInput) {
    const existing = await prisma.healthGoal.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Health goal not found");
    const goal = await prisma.healthGoal.update({ where: { id }, data: input });
    return serialize(goal);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.healthGoal.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Health goal not found");
    await prisma.healthGoal.delete({ where: { id } });
  },
};
