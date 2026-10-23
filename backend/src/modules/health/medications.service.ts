import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateMedicationInput, LogMedicationInput, UpdateMedicationInput } from "./medications.dto";

export const medicationsService = {
  async list(userId: string, activeOnly = false) {
    return prisma.medication.findMany({
      where: { userId, ...(activeOnly ? { active: true } : {}) },
      orderBy: { createdAt: "desc" },
    });
  },

  async getById(userId: string, id: string) {
    const medication = await prisma.medication.findFirst({ where: { id, userId } });
    if (!medication) throw AppError.notFound("Medication not found");
    return medication;
  },

  async create(userId: string, input: CreateMedicationInput) {
    return prisma.medication.create({ data: { ...input, userId } });
  },

  async update(userId: string, id: string, input: UpdateMedicationInput) {
    const existing = await prisma.medication.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Medication not found");
    return prisma.medication.update({ where: { id }, data: input });
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.medication.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Medication not found");
    await prisma.medication.delete({ where: { id } });
  },

  async logDose(userId: string, medicationId: string, input: LogMedicationInput) {
    const medication = await prisma.medication.findFirst({ where: { id: medicationId, userId } });
    if (!medication) throw AppError.notFound("Medication not found");
    return prisma.medicationLog.create({
      data: { userId, medicationId, status: input.status, scheduledFor: input.scheduledFor, takenAt: input.status === "TAKEN" ? new Date() : null },
    });
  },

  async getLogs(userId: string, medicationId: string, limit = 90) {
    const medication = await prisma.medication.findFirst({ where: { id: medicationId, userId } });
    if (!medication) throw AppError.notFound("Medication not found");
    return prisma.medicationLog.findMany({
      where: { userId, medicationId },
      orderBy: { scheduledFor: "desc" },
      take: limit,
    });
  },
};
