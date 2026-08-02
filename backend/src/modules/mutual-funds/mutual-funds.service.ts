import { InvestmentCategory, InvestmentStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { getLiveCagrRates, LiveCagrResult } from "../investment-comparison/live-return.service";
import { InvestmentInstrumentType } from "../investment-comparison/investment-comparison.constants";
import { mapSchemeCategoryToBenchmark } from "./mutual-funds.constants";
import { computeFundXirr, computeRating, groupInvestmentsByFund } from "./mutual-funds.util";
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
        };
      })
      .sort((a, b) => b.currentValue - a.currentValue);

    const totalInvested = round(funds.reduce((sum, f) => sum + f.investedAmount, 0));
    const totalCurrentValue = round(funds.reduce((sum, f) => sum + f.currentValue, 0));
    const totalProfit = round(totalCurrentValue - totalInvested);
    const totalProfitPercent = totalInvested > 0 ? round((totalProfit / totalInvested) * 100) : 0;

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

    return {
      summary: {
        totalInvested,
        totalCurrentValue,
        totalProfit,
        totalProfitPercent,
        overallXirrPercent,
        fundCount: funds.length,
        ratingCounts,
      },
      allocation,
      funds,
    };
  },
};
