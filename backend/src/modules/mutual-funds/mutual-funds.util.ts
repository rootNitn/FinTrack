import { Investment } from "@prisma/client";
import { calculateXirr, CashFlow } from "../../utils/xirr.util";
import { RATING_BAND_PERCENT, ABSOLUTE_RATING_THRESHOLDS } from "./mutual-funds.constants";

export interface FundLot {
  purchaseDate: Date;
  principalAmount: number;
}

/** One row per distinct mutual fund holding, aggregated across every `Investment` lot (e.g. SIP installments) that belong to it. */
export interface FundGroup {
  key: string;
  name: string;
  mfSchemeCode: number | null;
  mfSchemeCategory: string | null;
  units: number;
  investedAmount: number;
  currentValue: number;
  lots: FundLot[];
  lastPriceRefreshAt: Date | null;
}

/**
 * Groups a user's raw `MUTUAL_FUNDS` category Investment rows into one entry per distinct fund.
 * Each broker-imported SIP installment (or manually logged top-up) is its own `Investment` row
 * with the same fund name — grouping by the resolved `mfSchemeCode` (falling back to normalized
 * name when the scheme hasn't been resolved yet) is required to show one dashboard row per fund
 * instead of one per lot, and to compute a correct multi-cash-flow XIRR.
 */
export function groupInvestmentsByFund(investments: Investment[]): FundGroup[] {
  const groups = new Map<string, FundGroup>();

  for (const inv of investments) {
    const key = inv.mfSchemeCode ? `code:${inv.mfSchemeCode}` : `name:${inv.name.trim().toLowerCase()}`;
    const principal = Number(inv.principalAmount);
    const current = Number(inv.currentValue);
    const units = inv.units ? Number(inv.units) : 0;

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: inv.name,
        mfSchemeCode: inv.mfSchemeCode,
        mfSchemeCategory: inv.mfSchemeCategory,
        units: 0,
        investedAmount: 0,
        currentValue: 0,
        lots: [],
        lastPriceRefreshAt: null,
      };
      groups.set(key, group);
    }

    group.units += units;
    group.investedAmount += principal;
    group.currentValue += current;
    group.lots.push({ purchaseDate: inv.purchaseDate, principalAmount: principal });
    if (!group.mfSchemeCode && inv.mfSchemeCode) group.mfSchemeCode = inv.mfSchemeCode;
    if (!group.mfSchemeCategory && inv.mfSchemeCategory) group.mfSchemeCategory = inv.mfSchemeCategory;
    if (inv.lastPriceRefreshAt && (!group.lastPriceRefreshAt || inv.lastPriceRefreshAt > group.lastPriceRefreshAt)) {
      group.lastPriceRefreshAt = inv.lastPriceRefreshAt;
    }
  }

  return Array.from(groups.values());
}

/** Builds the cash-flow series for a fund group (each lot's purchase as an outflow, current aggregated value as today's inflow) and solves for XIRR. */
export function computeFundXirr(group: FundGroup): number | null {
  const cashFlows: CashFlow[] = group.lots.map((lot) => ({ amount: -lot.principalAmount, date: lot.purchaseDate }));
  cashFlows.push({ amount: group.currentValue, date: new Date() });
  return calculateXirr(cashFlows);
}

export type FundRating = "OUTPERFORMING" | "IN_LINE" | "UNDERPERFORMING" | "GOOD" | "AVERAGE" | "POOR";
export type RatingBasis = "BENCHMARK" | "ABSOLUTE";

export interface RatingResult {
  rating: FundRating;
  basis: RatingBasis;
}

/**
 * Rates a fund's XIRR either against a live category benchmark CAGR (preferred, within a
 * `RATING_BAND_PERCENT` band counted as "in line") or, when no benchmark is available, against
 * fixed absolute thresholds. Returns `null` when there isn't enough data yet (XIRR couldn't be
 * computed, e.g. a brand-new holding with no meaningful elapsed time).
 */
export function computeRating(xirrPercent: number | null, benchmarkPercent: number | null | undefined): RatingResult | null {
  if (xirrPercent === null) return null;

  if (typeof benchmarkPercent === "number") {
    const diff = xirrPercent - benchmarkPercent;
    if (diff > RATING_BAND_PERCENT) return { rating: "OUTPERFORMING", basis: "BENCHMARK" };
    if (diff < -RATING_BAND_PERCENT) return { rating: "UNDERPERFORMING", basis: "BENCHMARK" };
    return { rating: "IN_LINE", basis: "BENCHMARK" };
  }

  if (xirrPercent > ABSOLUTE_RATING_THRESHOLDS.GOOD) return { rating: "GOOD", basis: "ABSOLUTE" };
  if (xirrPercent >= ABSOLUTE_RATING_THRESHOLDS.AVERAGE) return { rating: "AVERAGE", basis: "ABSOLUTE" };
  return { rating: "POOR", basis: "ABSOLUTE" };
}
