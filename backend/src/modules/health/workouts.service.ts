import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateWorkoutInput, UpdateWorkoutInput } from "./workouts.dto";
import { recalcWorkoutWeeklyGoals } from "./health-goal-sync.util";
import { refreshCanonicalHealthDay } from "./health-connect.service";

function serialize<T extends Record<string, unknown>>(log: T) {
  return {
    ...log,
    distanceKm: log.distanceKm != null ? Number(log.distanceKm as Prisma.Decimal) : null,
  };
}

export const workoutsService = {
  async list(userId: string, limit = 90) {
    const logs = await prisma.workoutLog.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: limit,
    });
    return logs.map(serialize);
  },

  async create(userId: string, input: CreateWorkoutInput) {
    const log = await prisma.workoutLog.create({ data: { ...input, userId } });
    await recalcWorkoutWeeklyGoals(userId);
    await refreshCanonicalHealthDay(userId, log.date);
    return serialize(log);
  },

  async update(userId: string, id: string, input: UpdateWorkoutInput) {
    const existing = await prisma.workoutLog.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Workout log not found");
    const log = await prisma.workoutLog.update({ where: { id }, data: input });
    await recalcWorkoutWeeklyGoals(userId);
    await refreshCanonicalHealthDay(userId, log.date);
    if (input.date && input.date.getTime() !== existing.date.getTime()) await refreshCanonicalHealthDay(userId, existing.date);
    return serialize(log);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.workoutLog.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Workout log not found");
    await prisma.workoutLog.delete({ where: { id } });
    await recalcWorkoutWeeklyGoals(userId);
    await refreshCanonicalHealthDay(userId, existing.date);
  },
};
