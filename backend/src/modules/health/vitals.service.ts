import { Prisma, VitalType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateVitalInput, UpdateVitalInput } from "./vitals.dto";
import { refreshCanonicalHealthDay } from "./health-connect.service";

function serialize<T extends Record<string, unknown>>(log: T) {
  return {
    ...log,
    value: log.value != null ? Number(log.value as Prisma.Decimal) : null,
  };
}

export const vitalsService = {
  async list(userId: string, type?: VitalType, limit = 90) {
    const logs = await prisma.vitalLog.findMany({
      where: { userId, ...(type ? { type } : {}) },
      orderBy: { recordedAt: "desc" },
      take: limit,
    });
    return logs.map(serialize);
  },

  async create(userId: string, input: CreateVitalInput) {
    const log = await prisma.vitalLog.create({ data: { ...input, userId } });
    if (input.type === "HEART_RATE") await refreshCanonicalHealthDay(userId, log.recordedAt);
    return serialize(log);
  },

  async update(userId: string, id: string, input: UpdateVitalInput) {
    const existing = await prisma.vitalLog.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Vital log not found");
    const log = await prisma.vitalLog.update({ where: { id }, data: input });
    if (existing.type === "HEART_RATE") {
      await refreshCanonicalHealthDay(userId, log.recordedAt);
      if (input.recordedAt && input.recordedAt.getTime() !== existing.recordedAt.getTime()) await refreshCanonicalHealthDay(userId, existing.recordedAt);
    }
    return serialize(log);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.vitalLog.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Vital log not found");
    await prisma.vitalLog.delete({ where: { id } });
    if (existing.type === "HEART_RATE") await refreshCanonicalHealthDay(userId, existing.recordedAt);
  },
};
