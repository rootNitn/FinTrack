import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateBodyMetricInput, UpdateBodyMetricInput } from "./body-metrics.dto";
import { recalcWeightGoals } from "./health-goal-sync.util";
import { refreshCanonicalHealthDay } from "./health-connect.service";

function serialize<T extends Record<string, unknown>>(log: T) {
  return {
    ...log,
    weightKg: Number(log.weightKg as Prisma.Decimal),
    heightCm: log.heightCm != null ? Number(log.heightCm as Prisma.Decimal) : null,
    bmi: log.bmi != null ? Number(log.bmi as Prisma.Decimal) : null,
    bodyFatPercent: log.bodyFatPercent != null ? Number(log.bodyFatPercent as Prisma.Decimal) : null,
    waistCm: log.waistCm != null ? Number(log.waistCm as Prisma.Decimal) : null,
  };
}

async function resolveHeightCm(userId: string, explicitHeightCm?: number): Promise<number | undefined> {
  if (explicitHeightCm) return explicitHeightCm;
  const last = await prisma.bodyMetricLog.findFirst({
    where: { userId, heightCm: { not: null } },
    orderBy: { recordedAt: "desc" },
    select: { heightCm: true },
  });
  return last?.heightCm != null ? Number(last.heightCm) : undefined;
}

function computeBmi(weightKg: number, heightCm?: number): number | undefined {
  if (!heightCm) return undefined;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(2));
}

export const bodyMetricsService = {
  async list(userId: string, limit = 90) {
    const logs = await prisma.bodyMetricLog.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      take: limit,
    });
    return logs.map(serialize);
  },

  async latest(userId: string) {
    const log = await prisma.bodyMetricLog.findFirst({ where: { userId }, orderBy: { recordedAt: "desc" } });
    return log ? serialize(log) : null;
  },

  async create(userId: string, input: CreateBodyMetricInput) {
    const heightCm = await resolveHeightCm(userId, input.heightCm);
    const bmi = computeBmi(input.weightKg, heightCm);
    const log = await prisma.bodyMetricLog.create({ data: { ...input, userId, bmi } });
    await recalcWeightGoals(userId);
    await refreshCanonicalHealthDay(userId, log.recordedAt);
    return serialize(log);
  },

  async update(userId: string, id: string, input: UpdateBodyMetricInput) {
    const existing = await prisma.bodyMetricLog.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Body metric log not found");

    const weightKg = input.weightKg ?? Number(existing.weightKg);
    const heightCm = await resolveHeightCm(
      userId,
      input.heightCm ?? (existing.heightCm != null ? Number(existing.heightCm) : undefined)
    );
    const bmi = computeBmi(weightKg, heightCm);

    const log = await prisma.bodyMetricLog.update({ where: { id }, data: { ...input, bmi } });
    await recalcWeightGoals(userId);
    await refreshCanonicalHealthDay(userId, log.recordedAt);
    return serialize(log);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.bodyMetricLog.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Body metric log not found");
    await prisma.bodyMetricLog.delete({ where: { id } });
    await recalcWeightGoals(userId);
    await refreshCanonicalHealthDay(userId, existing.recordedAt);
  },
};
