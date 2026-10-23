import { HealthGoalType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { isNotificationEnabled } from "../../utils/notification-preferences";

/** Monday (UTC) of the week containing `date`, used as the recurring-period key for weekly goals. */
function weekStartKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function notifyAchieved(userId: string, goalId: string, period: string, message: string) {
  if (!(await isNotificationEnabled(userId, "healthGoalAchievement"))) return;

  const alreadyNotified = await prisma.notification.findFirst({
    where: {
      userId,
      type: "HEALTH_GOAL_ACHIEVEMENT",
      AND: [
        { meta: { path: ["healthGoalId"], equals: goalId } },
        { meta: { path: ["period"], equals: period } },
      ],
    },
  });
  if (alreadyNotified) return;

  await prisma.notification.create({
    data: {
      userId,
      type: "HEALTH_GOAL_ACHIEVEMENT",
      title: "Health goal achieved! 🎉",
      message,
      meta: { healthGoalId: goalId, period },
    },
  });
}

/** Weight-loss assumption: a WEIGHT_TARGET goal is "achieved" once the latest weight reaches at or below the target. */
export async function recalcWeightGoals(userId: string): Promise<void> {
  const latest = await prisma.bodyMetricLog.findFirst({ where: { userId }, orderBy: { recordedAt: "desc" } });
  const currentValue = latest ? Number(latest.weightKg) : 0;

  const goals = await prisma.healthGoal.findMany({ where: { userId, type: "WEIGHT_TARGET" } });
  for (const goal of goals) {
    const achieved = currentValue > 0 && currentValue <= Number(goal.targetValue);
    await prisma.healthGoal.update({
      where: { id: goal.id },
      data: { currentValue, achievedAt: achieved ? (goal.achievedAt ?? new Date()) : null },
    });
    if (achieved) {
      await notifyAchieved(userId, goal.id, "once", `You've reached your target weight of ${goal.targetValue} kg.`);
    }
  }
}

const DAILY_GOAL_FIELD: Record<string, "steps" | "waterIntakeMl" | "sleepHours"> = {
  STEPS_DAILY: "steps",
  WATER_DAILY: "waterIntakeMl",
  SLEEP_DAILY: "sleepHours",
};

export async function recalcDailyGoals(userId: string, date = new Date()): Promise<void> {
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const log = await prisma.dailyWellnessLog.findUnique({ where: { userId_date: { userId, date: dayStart } } });

  const goals = await prisma.healthGoal.findMany({
    where: { userId, type: { in: ["STEPS_DAILY", "WATER_DAILY", "SLEEP_DAILY"] } },
  });
  const period = dayKey(dayStart);

  for (const goal of goals) {
    const field = DAILY_GOAL_FIELD[goal.type];
    const raw = log?.[field];
    const currentValue = raw != null ? Number(raw) : 0;
    const achieved = currentValue >= Number(goal.targetValue);
    await prisma.healthGoal.update({
      where: { id: goal.id },
      data: { currentValue, achievedAt: achieved ? new Date() : null },
    });
    if (achieved) {
      await notifyAchieved(userId, goal.id, period, `You've hit today's ${goal.type.replace("_DAILY", "").toLowerCase()} goal.`);
    }
  }
}

export async function recalcWorkoutWeeklyGoals(userId: string, date = new Date()): Promise<void> {
  const monday = new Date(weekStartKey(date) + "T00:00:00.000Z");
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);

  const workouts = await prisma.workoutLog.findMany({
    where: { userId, date: { gte: monday, lt: nextMonday } },
    select: { durationMinutes: true },
  });
  const currentValue = workouts.reduce((sum, w) => sum + w.durationMinutes, 0);

  const goals = await prisma.healthGoal.findMany({ where: { userId, type: "WORKOUT_WEEKLY" } });
  const period = weekStartKey(date);

  for (const goal of goals) {
    const achieved = currentValue >= Number(goal.targetValue);
    await prisma.healthGoal.update({
      where: { id: goal.id },
      data: { currentValue, achievedAt: achieved ? new Date() : null },
    });
    if (achieved) {
      await notifyAchieved(userId, goal.id, period, "You've hit this week's workout minutes goal.");
    }
  }
}

/** Runs the matching recalculation immediately after a HealthGoal is created, so it isn't blank until the next log write. */
export async function syncGoalOnCreate(userId: string, type: HealthGoalType): Promise<void> {
  if (type === "WEIGHT_TARGET") return recalcWeightGoals(userId);
  if (type === "WORKOUT_WEEKLY") return recalcWorkoutWeeklyGoals(userId);
  return recalcDailyGoals(userId);
}
