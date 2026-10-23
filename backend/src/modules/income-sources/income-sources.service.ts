import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateIncomeSourceInput, UpdateIncomeSourceInput } from "./income-sources.dto";

function serialize<T extends Record<string, unknown>>(source: T) {
  return {
    ...source,
    monthlyAverageAmount: Number(source.monthlyAverageAmount as Prisma.Decimal),
    annualAmount: source.annualAmount === null ? null : Number(source.annualAmount as Prisma.Decimal),
  };
}

export const incomeSourcesService = {
  async list(userId: string) {
    const rows = await prisma.incomeSourceProfile.findMany({ where: { userId }, orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] });
    return rows.map(serialize);
  },

  async create(userId: string, input: CreateIncomeSourceInput) {
    const row = await prisma.incomeSourceProfile.create({ data: { ...input, userId } });
    return serialize(row);
  },

  async update(userId: string, id: string, input: UpdateIncomeSourceInput) {
    const existing = await prisma.incomeSourceProfile.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Income source not found");
    return serialize(await prisma.incomeSourceProfile.update({ where: { id }, data: input }));
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.incomeSourceProfile.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Income source not found");
    await prisma.incomeSourceProfile.delete({ where: { id } });
  },
};
