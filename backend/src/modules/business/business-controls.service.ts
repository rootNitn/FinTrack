import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreatePeriodInput } from "./business-controls.dto";

async function owned(userId: string, businessId: string) { const business = await prisma.businessProfile.findFirst({ where: { id: businessId, userId } }); if (!business) throw AppError.notFound("Business not found"); return business; }

export const businessControlsService = {
  async periods(userId: string, businessId: string) { await owned(userId, businessId); return prisma.businessAccountingPeriod.findMany({ where: { businessId }, orderBy: { startDate: "desc" } }); },
  async createPeriod(userId: string, businessId: string, input: CreatePeriodInput) { await owned(userId, businessId); return prisma.businessAccountingPeriod.upsert({ where: { businessId_period: { businessId, period: input.period } }, update: input, create: { businessId, ...input } }); },
  async close(userId: string, businessId: string, period: string) { await owned(userId, businessId); const result = await prisma.businessAccountingPeriod.update({ where: { businessId_period: { businessId, period } }, data: { isClosed: true, closedAt: new Date(), closedBy: userId } }); await prisma.auditLog.create({ data: { userId, action: "CLOSE_BUSINESS_PERIOD", entity: "BusinessAccountingPeriod", entityId: result.id, meta: { businessId, period } } }); return result; },
  async reopen(userId: string, businessId: string, period: string) { await owned(userId, businessId); const result = await prisma.businessAccountingPeriod.update({ where: { businessId_period: { businessId, period } }, data: { isClosed: false, closedAt: null, closedBy: null } }); await prisma.auditLog.create({ data: { userId, action: "REOPEN_BUSINESS_PERIOD", entity: "BusinessAccountingPeriod", entityId: result.id, meta: { businessId, period } } }); return result; },
};

export async function assertBusinessPeriodOpen(businessId: string, entryDate: Date) {
  const period = await prisma.businessAccountingPeriod.findFirst({ where: { businessId, startDate: { lte: entryDate }, endDate: { gte: entryDate }, isClosed: true } });
  if (period) throw AppError.badRequest(`Accounting period ${period.period} is closed`);
}
