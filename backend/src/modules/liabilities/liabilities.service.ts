import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateLiabilityInput, DebtPayoffStrategyInput, PrepaymentImpactInput, UpdateLiabilityInput } from "./liabilities.dto";
import { buildAmortizationSchedule, computeEmi, simulateDebtPayoff, summarizeAmortization } from "./loan-amortization.util";

function serializeLiability<T extends Record<string, unknown>>(liability: T) {
  return {
    ...liability,
    amount: Number(liability.amount as Prisma.Decimal),
    interestRatePercent: liability.interestRatePercent !== null ? Number(liability.interestRatePercent as Prisma.Decimal) : null,
    principalAmount: liability.principalAmount !== null ? Number(liability.principalAmount as Prisma.Decimal) : null,
    emiAmount: liability.emiAmount !== null ? Number(liability.emiAmount as Prisma.Decimal) : null,
  };
}

/** A liability needs these 3 fields (plus interestRatePercent, which may legitimately be 0 for a 0% loan) to derive a schedule. */
function loanTermsFrom(liability: {
  principalAmount: Prisma.Decimal | null;
  interestRatePercent: Prisma.Decimal | null;
  tenureMonths: number | null;
  startDate: Date | null;
}) {
  if (liability.principalAmount === null || liability.tenureMonths === null || liability.startDate === null) return null;
  return {
    principal: Number(liability.principalAmount),
    annualRatePercent: liability.interestRatePercent !== null ? Number(liability.interestRatePercent) : 0,
    tenureMonths: liability.tenureMonths,
    startDate: liability.startDate,
  };
}

export const liabilitiesService = {
  async list(userId: string) {
    const liabilities = await prisma.liability.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return liabilities.map(serializeLiability);
  },

  async create(userId: string, input: CreateLiabilityInput) {
    const liability = await prisma.liability.create({ data: { ...input, userId } });
    return serializeLiability(liability);
  },

  async update(userId: string, id: string, input: UpdateLiabilityInput) {
    const existing = await prisma.liability.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Liability not found");
    const liability = await prisma.liability.update({ where: { id }, data: input });
    return serializeLiability(liability);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.liability.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Liability not found");
    await prisma.liability.delete({ where: { id } });
  },

  /** EMI + full amortization schedule + as-of-today summary, derived from the loan's original terms. */
  async getAmortization(userId: string, id: string) {
    const liability = await prisma.liability.findFirst({ where: { id, userId } });
    if (!liability) throw AppError.notFound("Liability not found");

    const terms = loanTermsFrom(liability);
    if (!terms) {
      throw AppError.badRequest(
        "Add the original principal, tenure (months) and start date to this liability to view its EMI schedule."
      );
    }

    const schedule = buildAmortizationSchedule(terms);
    const summary = summarizeAmortization(schedule, new Date());
    return { liability: serializeLiability(liability), emi: computeEmi(terms.principal, terms.annualRatePercent, terms.tenureMonths), schedule, summary };
  },

  /** What-if: how much interest/time is saved by paying extra each month and/or a one-time lump sum now — a pure calculation, nothing is persisted. */
  async getPrepaymentImpact(userId: string, id: string, input: PrepaymentImpactInput) {
    const liability = await prisma.liability.findFirst({ where: { id, userId } });
    if (!liability) throw AppError.notFound("Liability not found");

    const terms = loanTermsFrom(liability);
    if (!terms) {
      throw AppError.badRequest(
        "Add the original principal, tenure (months) and start date to this liability to run a prepayment what-if."
      );
    }

    const baselineSchedule = buildAmortizationSchedule(terms);
    const baselineSummary = summarizeAmortization(baselineSchedule, new Date(0));

    const withPrepaymentTerms = { ...terms, principal: Math.max(0, terms.principal - input.lumpSum) };
    const withPrepaymentSchedule = buildAmortizationSchedule(withPrepaymentTerms, input.extraMonthlyPayment);
    const withPrepaymentSummary = summarizeAmortization(withPrepaymentSchedule, new Date(0));

    return {
      baseline: {
        months: baselineSchedule.length,
        totalInterest: baselineSummary.totalInterest,
        payoffDate: baselineSummary.payoffDate,
      },
      withPrepayment: {
        months: withPrepaymentSchedule.length,
        totalInterest: withPrepaymentSummary.totalInterest,
        payoffDate: withPrepaymentSummary.payoffDate,
        extraMonthlyPayment: input.extraMonthlyPayment,
        lumpSum: input.lumpSum,
      },
      monthsSaved: Math.max(0, baselineSchedule.length - withPrepaymentSchedule.length),
      interestSaved: Math.max(0, Math.round((baselineSummary.totalInterest - withPrepaymentSummary.totalInterest) * 100) / 100),
    };
  },

  /**
   * Compares avalanche vs snowball payoff order across ALL of the user's loans at once, given an
   * optional extra monthly budget to put toward debt. Only liabilities with full loan terms
   * (principal/tenure/start date) can be simulated on a schedule — others are returned separately
   * so the user knows why they're excluded.
   */
  async getDebtPayoffStrategy(userId: string, input: DebtPayoffStrategyInput) {
    const liabilities = await prisma.liability.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });

    const excluded: { id: string; name: string; amount: number }[] = [];
    const eligible: { id: string; name: string; balance: number; annualRatePercent: number; emi: number }[] = [];

    for (const liability of liabilities) {
      const terms = loanTermsFrom(liability);
      if (!terms) {
        excluded.push({ id: liability.id, name: liability.name, amount: Number(liability.amount) });
        continue;
      }
      const schedule = buildAmortizationSchedule(terms);
      const summary = summarizeAmortization(schedule, new Date());
      if (summary.remainingBalance <= 0.01) continue; // already paid off, nothing to simulate
      eligible.push({
        id: liability.id,
        name: liability.name,
        balance: summary.remainingBalance,
        annualRatePercent: terms.annualRatePercent,
        emi: summary.emi,
      });
    }

    if (eligible.length === 0) {
      return { eligibleLoans: [], excludedLiabilities: excluded, extraMonthlyBudget: input.extraMonthlyBudget, baseline: null, avalanche: null, snowball: null, betterStrategy: null };
    }

    const baseline = simulateDebtPayoff(eligible, 0, "AVALANCHE"); // strategy is irrelevant with no extra budget — loans don't interact
    const avalanche = simulateDebtPayoff(eligible, input.extraMonthlyBudget, "AVALANCHE");
    const snowball = simulateDebtPayoff(eligible, input.extraMonthlyBudget, "SNOWBALL");
    const betterStrategy = avalanche.totalInterestPaid <= snowball.totalInterestPaid ? "AVALANCHE" : "SNOWBALL";

    return {
      eligibleLoans: eligible.map((loan) => ({ id: loan.id, name: loan.name, balance: loan.balance, annualRatePercent: loan.annualRatePercent, emi: loan.emi })),
      excludedLiabilities: excluded,
      extraMonthlyBudget: input.extraMonthlyBudget,
      baseline: { totalMonths: baseline.totalMonths, totalInterestPaid: baseline.totalInterestPaid },
      avalanche,
      snowball,
      betterStrategy,
      interestSavedVsBaseline: {
        avalanche: Math.max(0, Math.round((baseline.totalInterestPaid - avalanche.totalInterestPaid) * 100) / 100),
        snowball: Math.max(0, Math.round((baseline.totalInterestPaid - snowball.totalInterestPaid) * 100) / 100),
      },
    };
  },
};