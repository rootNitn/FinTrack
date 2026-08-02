import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { calculateFd } from "./fd-calculation.util";
import { CreateFdPortfolioInput, UpdateFdPortfolioInput } from "./fd-portfolio.dto";

function serialize<T extends Record<string, unknown>>(entry: T) {
  return {
    ...entry,
    amount: Number(entry.amount as Prisma.Decimal),
    interestRate: Number(entry.interestRate as Prisma.Decimal),
    maturityAmount: Number(entry.maturityAmount as Prisma.Decimal),
  };
}

function tenureDaysBetween(opening: Date, maturity: Date): number {
  return Math.max(1, Math.round((maturity.getTime() - opening.getTime()) / (1000 * 60 * 60 * 24)));
}

export const fdPortfolioService = {
  async list(userId: string) {
    const entries = await prisma.fdPortfolio.findMany({ where: { userId }, orderBy: { maturityDate: "asc" } });
    return entries.map(serialize);
  },

  async getById(userId: string, id: string) {
    const entry = await prisma.fdPortfolio.findFirst({ where: { id, userId } });
    if (!entry) throw AppError.notFound("Portfolio entry not found");
    return serialize(entry);
  },

  async create(userId: string, input: CreateFdPortfolioInput) {
    const tenureDays = tenureDaysBetween(input.openingDate, input.maturityDate);
    const result = calculateFd({
      principal: input.amount,
      annualRatePercent: input.interestRate,
      tenureValue: tenureDays,
      tenureUnit: "DAYS",
      depositType: input.depositType,
      compounding: input.compounding,
      startDate: input.openingDate,
    });

    const entry = await prisma.fdPortfolio.create({
      data: {
        userId,
        bankId: input.bankId,
        bankName: input.bankName,
        amount: input.amount,
        interestRate: input.interestRate,
        depositType: input.depositType,
        compounding: input.compounding,
        openingDate: input.openingDate,
        maturityDate: input.maturityDate,
        maturityAmount: result.maturityAmount,
        nominee: input.nominee,
        notes: input.notes,
        status: input.status,
      },
    });
    return serialize(entry);
  },

  async update(userId: string, id: string, input: UpdateFdPortfolioInput) {
    const existing = await prisma.fdPortfolio.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Portfolio entry not found");

    const amount = input.amount ?? Number(existing.amount);
    const interestRate = input.interestRate ?? Number(existing.interestRate);
    const depositType = input.depositType ?? existing.depositType;
    const compounding = input.compounding ?? existing.compounding;
    const openingDate = input.openingDate ?? existing.openingDate;
    const maturityDate = input.maturityDate ?? existing.maturityDate;

    const tenureDays = tenureDaysBetween(openingDate, maturityDate);
    const result = calculateFd({
      principal: amount,
      annualRatePercent: interestRate,
      tenureValue: tenureDays,
      tenureUnit: "DAYS",
      depositType,
      compounding,
      startDate: openingDate,
    });

    const entry = await prisma.fdPortfolio.update({
      where: { id },
      data: { ...input, maturityAmount: result.maturityAmount },
    });
    return serialize(entry);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.fdPortfolio.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Portfolio entry not found");
    await prisma.fdPortfolio.delete({ where: { id } });
  },

  async summary(userId: string) {
    const entries = await prisma.fdPortfolio.findMany({ where: { userId, status: "ACTIVE" } });

    const portfolioValue = entries.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalMaturityValue = entries.reduce((sum, e) => sum + Number(e.maturityAmount), 0);
    const totalInterestEarned = totalMaturityValue - portfolioValue;

    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const upcomingMaturities = entries
      .filter((e) => e.maturityDate >= now && e.maturityDate <= in30Days)
      .map(serialize)
      .sort((a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime());

    return {
      portfolioValue: Number(portfolioValue.toFixed(2)),
      totalMaturityValue: Number(totalMaturityValue.toFixed(2)),
      totalInterestEarned: Number(totalInterestEarned.toFixed(2)),
      activeCount: entries.length,
      upcomingMaturities,
    };
  },
};
