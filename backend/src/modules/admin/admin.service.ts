import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import { Request } from "express";
import { Prisma } from "@prisma/client";

export const adminService = {
  async listUsers(req: Request) {
    const { skip, take, search, page, limit } = parsePagination(req, "createdAt");
    const where: Prisma.UserWhereInput = search
      ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] }
      : {};

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(total, page, limit) };
  },

  async setUserActive(userId: string, isActive: boolean) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound("User not found");
    return prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  },

  async setUserRole(userId: string, role: "USER" | "ADMIN") {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound("User not found");
    return prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  },

  async getAnalytics() {
    const [totalUsers, activeUsers, totalInvestments, totalExpenses, totalIncome, investmentAgg] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.investment.count(),
      prisma.expense.count(),
      prisma.income.count(),
      prisma.investment.aggregate({ _sum: { currentValue: true, principalAmount: true } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalInvestments,
      totalExpenses,
      totalIncome,
      totalInvestedAcrossUsers: Number(investmentAgg._sum.principalAmount ?? 0),
      totalCurrentValueAcrossUsers: Number(investmentAgg._sum.currentValue ?? 0),
    };
  },

  async listAuditLogs(req: Request) {
    const { skip, take, page, limit } = parsePagination(req, "createdAt");
    const { action, entity } = req.query as Record<string, string | undefined>;

    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action } : {}),
      ...(entity ? { entity } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(total, page, limit) };
  },
};
