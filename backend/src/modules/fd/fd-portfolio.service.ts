import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { calculateFd, tenureToDays } from "./fd-calculation.util";
import { CreateFdPortfolioInput, PrematureWithdrawalInput, RenewFdPortfolioInput, UpdateFdPortfolioInput } from "./fd-portfolio.dto";

function serialize<T extends Record<string, unknown>>(entry: T) {
  const familyMember = entry.familyMember as { name: string } | null | undefined;
  return {
    ...entry,
    amount: Number(entry.amount as Prisma.Decimal),
    interestRate: Number(entry.interestRate as Prisma.Decimal),
    maturityAmount: Number(entry.maturityAmount as Prisma.Decimal),
    familyMemberName: familyMember?.name ?? null,
    familyMember: undefined,
  };
}

function tenureDaysBetween(opening: Date, maturity: Date): number {
  return Math.max(1, Math.round((maturity.getTime() - opening.getTime()) / (1000 * 60 * 60 * 24)));
}

export const fdPortfolioService = {
  async list(userId: string, familyMemberId?: string) {
    const entries = await prisma.fdPortfolio.findMany({
      where: { userId, ...(familyMemberId ? { familyMemberId } : {}) },
      orderBy: { maturityDate: "asc" },
      include: { familyMember: { select: { name: true } } },
    });
    return entries.map(serialize);
  },

  async getById(userId: string, id: string) {
    const entry = await prisma.fdPortfolio.findFirst({
      where: { id, userId },
      include: { familyMember: { select: { name: true } } },
    });
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
        familyMemberId: input.familyMemberId,
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
      include: { familyMember: { select: { name: true } } },
    });
    return serialize(entry);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.fdPortfolio.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Portfolio entry not found");
    await prisma.fdPortfolio.delete({ where: { id } });
  },

  /**
   * Closes an ACTIVE FD before its maturity date. Recomputes the actual payout using the same
   * `calculateFd` engine as create/update, but over the ACTUAL held tenure and at a penalized
   * rate (contracted rate minus `penaltyRatePercent`) — the standard bank premature-closure
   * practice. Also reports what the FD would have paid at the full contracted rate for the same
   * held period, so the penalty cost is transparent rather than a silent number change.
   */
  async prematureWithdraw(userId: string, id: string, input: PrematureWithdrawalInput) {
    const existing = await prisma.fdPortfolio.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Portfolio entry not found");
    if (existing.status !== "ACTIVE") throw AppError.badRequest("Only an active FD can be withdrawn prematurely.");

    const withdrawalDate = input.withdrawalDate ?? new Date();
    if (withdrawalDate <= existing.openingDate) {
      throw AppError.badRequest("Withdrawal date must be after the FD's opening date.");
    }
    if (withdrawalDate >= existing.maturityDate) {
      throw AppError.badRequest("This FD has already matured — use the renew action instead of premature withdrawal.");
    }

    const principal = Number(existing.amount);
    const contractedRate = Number(existing.interestRate);
    const effectiveRate = Math.max(0, contractedRate - input.penaltyRatePercent);
    const tenureDaysHeld = tenureDaysBetween(existing.openingDate, withdrawalDate);

    const penalizedResult = calculateFd({
      principal,
      annualRatePercent: effectiveRate,
      tenureValue: tenureDaysHeld,
      tenureUnit: "DAYS",
      depositType: existing.depositType,
      compounding: existing.compounding,
      startDate: existing.openingDate,
    });
    const contractedResult = calculateFd({
      principal,
      annualRatePercent: contractedRate,
      tenureValue: tenureDaysHeld,
      tenureUnit: "DAYS",
      depositType: existing.depositType,
      compounding: existing.compounding,
      startDate: existing.openingDate,
    });

    const payoutAmount = penalizedResult.maturityAmount;
    const interestForfeited = Number((contractedResult.maturityAmount - payoutAmount).toFixed(2));
    const penaltyNote = `Prematurely withdrawn on ${withdrawalDate.toDateString()}: ${input.penaltyRatePercent}% penalty applied (effective rate ${effectiveRate}% instead of ${contractedRate}%). Payout: ${payoutAmount.toFixed(2)}.`;

    const updated = await prisma.fdPortfolio.update({
      where: { id },
      data: {
        status: "CLOSED",
        maturityDate: withdrawalDate,
        maturityAmount: payoutAmount,
        notes: existing.notes ? `${existing.notes}\n${penaltyNote}` : penaltyNote,
      },
      include: { familyMember: { select: { name: true } } },
    });

    return {
      fd: serialize(updated),
      payoutAmount,
      effectiveRatePercent: effectiveRate,
      penaltyRatePercent: input.penaltyRatePercent,
      tenureDaysHeld,
      interestForfeited,
    };
  },

  /**
   * Rolls a matured FD into a new one — closes the existing row (status RENEWED, figures
   * untouched) and creates a fresh FdPortfolio starting from the existing FD's maturity amount as
   * principal, on the same maturity date, for the given new tenure/rate.
   */
  async renew(userId: string, id: string, input: RenewFdPortfolioInput) {
    const existing = await prisma.fdPortfolio.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Portfolio entry not found");
    if (existing.status !== "ACTIVE") throw AppError.badRequest("Only an active FD can be renewed.");
    if (new Date() < existing.maturityDate) {
      throw AppError.badRequest("This FD hasn't matured yet — use the premature withdrawal action for an early exit.");
    }

    const principal = Number(existing.maturityAmount);
    const interestRate = input.newInterestRate ?? Number(existing.interestRate);
    const depositType = input.depositType ?? existing.depositType;
    const compounding = input.compounding ?? existing.compounding;
    const tenureDays = tenureToDays(input.tenureValue, input.tenureUnit);
    const newOpeningDate = existing.maturityDate;
    const newMaturityDate = new Date(newOpeningDate);
    newMaturityDate.setDate(newMaturityDate.getDate() + tenureDays);

    const result = calculateFd({
      principal,
      annualRatePercent: interestRate,
      tenureValue: tenureDays,
      tenureUnit: "DAYS",
      depositType,
      compounding,
      startDate: newOpeningDate,
    });

    const [closed, renewed] = await prisma.$transaction([
      prisma.fdPortfolio.update({ where: { id }, data: { status: "RENEWED" }, include: { familyMember: { select: { name: true } } } }),
      prisma.fdPortfolio.create({
        data: {
          userId,
          bankId: input.bankId ?? existing.bankId,
          bankName: input.bankName ?? existing.bankName,
          amount: principal,
          interestRate,
          depositType,
          compounding,
          openingDate: newOpeningDate,
          maturityDate: newMaturityDate,
          maturityAmount: result.maturityAmount,
          nominee: input.nominee ?? existing.nominee,
          notes: `Renewed from FD ${existing.id} on ${newOpeningDate.toDateString()}.`,
          familyMemberId: existing.familyMemberId,
        },
        include: { familyMember: { select: { name: true } } },
      }),
    ]);

    return { closed: serialize(closed), renewed: serialize(renewed) };
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
