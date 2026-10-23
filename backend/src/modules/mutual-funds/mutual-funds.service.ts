import { InvestmentCategory, InvestmentStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { getLiveCagrRates, LiveCagrResult } from "../investment-comparison/live-return.service";
import { InvestmentInstrumentType } from "../investment-comparison/investment-comparison.constants";
import { mapSchemeCategoryToBenchmark } from "./mutual-funds.constants";
import { computeFundXirr, computeRating, computeTermSplit, groupInvestmentsByFund } from "./mutual-funds.util";
import { calculateXirr, CashFlow } from "../../utils/xirr.util";

function round(value: number): number {
  return Number(value.toFixed(2));
}

export const mutualFundsService = {
  /**
   * Builds the full Mutual Funds dashboard payload for a user: one row per distinct fund
   * (grouped across SIP installments/lots) with XIRR + a performance rating vs its category
   * benchmark, plus a portfolio-level summary and category allocation breakdown.
   *
   * Read-only and fast — relies entirely on data already cached on the `Investment` rows
   * (`currentValue`, `mfSchemeCode`, `mfSchemeCategory`) by the existing "Refresh Prices" flow
   * (`investment-price-refresh.service.ts`), plus the already-cached benchmark CAGR rates from
   * the Investment Comparison module. No synchronous external API calls happen here.
   */
  async getDashboard(userId: string) {
    const investments = await prisma.investment.findMany({
      where: { userId, category: InvestmentCategory.MUTUAL_FUNDS, status: InvestmentStatus.ACTIVE },
    });

    const groups = groupInvestmentsByFund(investments);
    const liveCagrRates = await getLiveCagrRates().catch(
      () => ({} as Partial<Record<InvestmentInstrumentType, LiveCagrResult>>)
    );

    const funds = groups
      .map((group) => {
        const xirrPercent = computeFundXirr(group);
        const mapping = mapSchemeCategoryToBenchmark(group.mfSchemeCategory);
        const benchmark = mapping ? liveCagrRates[mapping.benchmark] : undefined;
        const ratingResult = computeRating(xirrPercent, benchmark?.percent);
        const profit = group.currentValue - group.investedAmount;
        const profitPercent = group.investedAmount > 0 ? (profit / group.investedAmount) * 100 : 0;
        const termSplit = computeTermSplit(group);
        const longTermPercent = group.currentValue > 0 ? round((termSplit.longTermValue / group.currentValue) * 100) : 0;

        return {
          key: group.key,
          name: group.name,
          categoryLabel: mapping?.label ?? group.mfSchemeCategory ?? "Unclassified",
          units: group.units > 0 ? round(group.units) : null,
          investedAmount: round(group.investedAmount),
          currentValue: round(group.currentValue),
          profit: round(profit),
          profitPercent: round(profitPercent),
          xirrPercent,
          benchmarkPercent: typeof benchmark?.percent === "number" ? round(benchmark.percent) : null,
          benchmarkLabel: mapping?.label ?? null,
          rating: ratingResult?.rating ?? null,
          ratingBasis: ratingResult?.basis ?? null,
          lastRefreshAt: group.lastPriceRefreshAt,
          needsRefresh: !group.mfSchemeCode,
          longTermInvested: round(termSplit.longTermInvested),
          shortTermInvested: round(termSplit.shortTermInvested),
          longTermValue: round(termSplit.longTermValue),
          shortTermValue: round(termSplit.shortTermValue),
          longTermPercent,
        };
      })
      .sort((a, b) => b.currentValue - a.currentValue);

    const totalInvested = round(funds.reduce((sum, f) => sum + f.investedAmount, 0));
    const totalCurrentValue = round(funds.reduce((sum, f) => sum + f.currentValue, 0));
    const totalProfit = round(totalCurrentValue - totalInvested);
    const totalProfitPercent = totalInvested > 0 ? round((totalProfit / totalInvested) * 100) : 0;
    const totalLongTermValue = round(funds.reduce((sum, f) => sum + f.longTermValue, 0));
    const totalShortTermValue = round(funds.reduce((sum, f) => sum + f.shortTermValue, 0));
    const totalLongTermInvested = round(funds.reduce((sum, f) => sum + f.longTermInvested, 0));
    const totalShortTermInvested = round(funds.reduce((sum, f) => sum + f.shortTermInvested, 0));

    // Overall XIRR across every lot of every fund — one money-weighted return for the whole
    // mutual fund portfolio (not just an average of per-fund XIRRs).
    const overallCashFlows: CashFlow[] = groups.flatMap((group) =>
      group.lots.map((lot) => ({ amount: -lot.principalAmount, date: lot.purchaseDate }))
    );
    overallCashFlows.push({ amount: totalCurrentValue, date: new Date() });
    const overallXirrPercent = calculateXirr(overallCashFlows);

    const ratingCounts = funds.reduce<Record<string, number>>((acc, f) => {
      if (f.rating) acc[f.rating] = (acc[f.rating] ?? 0) + 1;
      return acc;
    }, {});

    const allocationTotals = new Map<string, number>();
    for (const f of funds) {
      allocationTotals.set(f.categoryLabel, (allocationTotals.get(f.categoryLabel) ?? 0) + f.currentValue);
    }
    const allocation = Array.from(allocationTotals.entries()).map(([label, value]) => ({
      label,
      value: round(value),
    }));

    const categoryTotals = new Map<string, { fundCount: number; investedAmount: number; currentValue: number }>();
    for (const f of funds) {
      const entry = categoryTotals.get(f.categoryLabel) ?? { fundCount: 0, investedAmount: 0, currentValue: 0 };
      entry.fundCount += 1;
      entry.investedAmount += f.investedAmount;
      entry.currentValue += f.currentValue;
      categoryTotals.set(f.categoryLabel, entry);
    }
    const categoryBreakdown = Array.from(categoryTotals.entries())
      .map(([label, totals]) => {
        const profit = round(totals.currentValue - totals.investedAmount);
        return {
          label,
          fundCount: totals.fundCount,
          investedAmount: round(totals.investedAmount),
          currentValue: round(totals.currentValue),
          profit,
          profitPercent: totals.investedAmount > 0 ? round((profit / totals.investedAmount) * 100) : 0,
        };
      })
      .sort((a, b) => b.currentValue - a.currentValue);

    const termBreakdown = [
      {
        label: "Long Term (> 1 year)",
        investedAmount: totalLongTermInvested,
        currentValue: totalLongTermValue,
        profit: round(totalLongTermValue - totalLongTermInvested),
        profitPercent: totalLongTermInvested > 0 ? round(((totalLongTermValue - totalLongTermInvested) / totalLongTermInvested) * 100) : 0,
      },
      {
        label: "Short Term (\u2264 1 year)",
        investedAmount: totalShortTermInvested,
        currentValue: totalShortTermValue,
        profit: round(totalShortTermValue - totalShortTermInvested),
        profitPercent: totalShortTermInvested > 0 ? round(((totalShortTermValue - totalShortTermInvested) / totalShortTermInvested) * 100) : 0,
      },
    ];

    return {
      summary: {
        totalInvested,
        totalCurrentValue,
        totalProfit,
        totalProfitPercent,
        overallXirrPercent,
        fundCount: funds.length,
        ratingCounts,
        totalLongTermValue,
        totalShortTermValue,
      },
      allocation,
      categoryBreakdown,
      termBreakdown,
      funds,
    };
  },

  /**
   * Detail view for a single fund (identified by the same `key` used in the dashboard's `funds`
   * list — either `code:<mfSchemeCode>` or `name:<lowercased fund name>`): the same summary
   * metrics as the dashboard row, plus every underlying `Investment` lot (transaction/SIP
   * installment history) sorted newest-first.
   */
  async getFundDetail(userId: string, key: string) {
    const investments = await prisma.investment.findMany({
      where: { userId, category: InvestmentCategory.MUTUAL_FUNDS, status: InvestmentStatus.ACTIVE },
      orderBy: { purchaseDate: "desc" },
    });

    const groups = groupInvestmentsByFund(investments);
    const group = groups.find((g) => g.key === key);
    if (!group) throw AppError.notFound("Mutual fund holding not found");

    const liveCagrRates = await getLiveCagrRates().catch(
      () => ({} as Partial<Record<InvestmentInstrumentType, LiveCagrResult>>)
    );

    const xirrPercent = computeFundXirr(group);
    const mapping = mapSchemeCategoryToBenchmark(group.mfSchemeCategory);
    const benchmark = mapping ? liveCagrRates[mapping.benchmark] : undefined;
    const ratingResult = computeRating(xirrPercent, benchmark?.percent);
    const profit = group.currentValue - group.investedAmount;
    const profitPercent = group.investedAmount > 0 ? (profit / group.investedAmount) * 100 : 0;
    const termSplit = computeTermSplit(group);

    const transactions = investments
      .filter((inv) => {
        const invKey = inv.mfSchemeCode ? `code:${inv.mfSchemeCode}` : `name:${inv.name.trim().toLowerCase()}`;
        return invKey === key;
      })
      .sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime())
      .map((inv) => {
        const principalAmount = Number(inv.principalAmount);
        const currentValue = Number(inv.currentValue);
        return {
          id: inv.id,
          purchaseDate: inv.purchaseDate,
          principalAmount: round(principalAmount),
          currentValue: round(currentValue),
          profit: round(currentValue - principalAmount),
          units: inv.units ? round(Number(inv.units)) : null,
          purchaseNav: inv.purchaseNav ? round(Number(inv.purchaseNav)) : null,
          currentNav: inv.currentNav ? round(Number(inv.currentNav)) : null,
          isRecurring: inv.isRecurring,
          recurrenceInterval: inv.recurrenceInterval,
          nextRecurrenceDate: inv.nextRecurrenceDate,
        };
      });

    const sipLots = transactions.filter((t) => t.isRecurring);
    const sipInfo =
      sipLots.length > 0
        ? {
            installmentCount: sipLots.length,
            recurrenceInterval: sipLots[0].recurrenceInterval,
            nextRecurrenceDate: sipLots
              .map((t) => t.nextRecurrenceDate)
              .filter((d): d is Date => !!d)
              .sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
            latestInstallmentAmount: sipLots[0].principalAmount,
          }
        : null;

    return {
      key: group.key,
      name: group.name,
      categoryLabel: mapping?.label ?? group.mfSchemeCategory ?? "Unclassified",
      mfSchemeCode: group.mfSchemeCode,
      units: group.units > 0 ? round(group.units) : null,
      investedAmount: round(group.investedAmount),
      currentValue: round(group.currentValue),
      profit: round(profit),
      profitPercent: round(profitPercent),
      xirrPercent,
      benchmarkPercent: typeof benchmark?.percent === "number" ? round(benchmark.percent) : null,
      benchmarkLabel: mapping?.label ?? null,
      rating: ratingResult?.rating ?? null,
      ratingBasis: ratingResult?.basis ?? null,
      lastRefreshAt: group.lastPriceRefreshAt,
      needsRefresh: !group.mfSchemeCode,
      longTermInvested: round(termSplit.longTermInvested),
      shortTermInvested: round(termSplit.shortTermInvested),
      longTermValue: round(termSplit.longTermValue),
      shortTermValue: round(termSplit.shortTermValue),
      sipInfo,
      transactions,
    };
  },
};
