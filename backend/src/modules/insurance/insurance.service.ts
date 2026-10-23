import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateInsurancePolicyInput, UpdateInsurancePolicyInput } from "./insurance.dto";

function serializePolicy<T extends Record<string, unknown>>(policy: T) {
  return {
    ...policy,
    sumInsured: Number(policy.sumInsured as Prisma.Decimal),
    premiumAmount: policy.premiumAmount !== null ? Number(policy.premiumAmount as Prisma.Decimal) : null,
  };
}

export const insuranceService = {
  async list(userId: string) {
    const policies = await prisma.insurancePolicy.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return policies.map(serializePolicy);
  },

  async create(userId: string, input: CreateInsurancePolicyInput) {
    const policy = await prisma.insurancePolicy.create({ data: { ...input, userId } });
    return serializePolicy(policy);
  },

  async update(userId: string, id: string, input: UpdateInsurancePolicyInput) {
    const existing = await prisma.insurancePolicy.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Insurance policy not found");
    const policy = await prisma.insurancePolicy.update({ where: { id }, data: input });
    return serializePolicy(policy);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.insurancePolicy.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Insurance policy not found");
    await prisma.insurancePolicy.delete({ where: { id } });
  },
};
