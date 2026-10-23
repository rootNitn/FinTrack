import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { UpsertDailyLogInput } from "./daily-log.dto";
import { recalcDailyGoals } from "./health-goal-sync.util";
import { refreshCanonicalHealthDay } from "./health-connect.service";

function serialize<T extends Record<string, unknown>>(log: T) {
  return {
    ...log,
    sleepHours: log.sleepHours != null ? Number(log.sleepHours as Prisma.Decimal) : null,
  };
}

function startOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export const dailyLogService = {
  async list(userId: string, days = 30) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    const logs = await prisma.dailyWellnessLog.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: "desc" },
    });
    return logs.map(serialize);
  },

  async getByDate(userId: string, dateStr: string) {
    const log = await prisma.dailyWellnessLog.findUnique({
      where: { userId_date: { userId, date: startOfDay(dateStr) } },
    });
    return log ? serialize(log) : null;
  },

  async upsert(userId: string, dateStr: string, input: UpsertDailyLogInput) {
    const date = startOfDay(dateStr);
    const log = await prisma.dailyWellnessLog.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, ...input },
      update: input,
    });
    await recalcDailyGoals(userId, date);
    await refreshCanonicalHealthDay(userId, dateStr);
    return serialize(log);
  },
};
