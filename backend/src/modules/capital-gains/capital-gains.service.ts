import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { logAudit } from "../../utils/audit-log.util";
import { serializeDecimals } from "../documents/parsers/decimal.util";
import { CapitalGainAssetType, CapitalGainTermType, TaxCapitalGainRule } from "@prisma/client";
import { CalculateCapitalGainsInput, CapitalGainsTransactionInput } from "./capital-gains.dto";

const DECIMAL_FIELDS = [
  "purchasePrice",
  "salePrice",
  "quantity",
  "brokerage",
  "stampDuty",
  "transferCharges",
  "indexedCost",
  "gainAmount",
  "taxAmount",
] as const;

/** Long-term holding-period thresholds by asset type (simplified, documented assumption — see
 * PROJECT_OVERVIEW.md): equity shares/equity-oriented funds > 12 months, immovable property > 24
 * months, gold > 36 months. Crypto has no LTCG concept under Sec 115BBH (flat 30% regardless) but
 * is still classified here for record-keeping/display purposes only. */
const LONG_TERM_THRESHOLD_DAYS: Record<CapitalGainAssetType, number> = {
  STOCK: 365,
  MUTUAL_FUND: 365,
  PROPERTY: 730,
  GOLD: 1095,
  CRYPTO: 1095,
};

function financialYearFromDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-based; April = 3
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

interface ComputedTransaction {
  input: CapitalGainsTransactionInput;
  termType: CapitalGainTermType;
  holdingPeriodDays: number;
  indexedCost: number | null;
  rawGain: number;
  rule: TaxCapitalGainRule | undefined;
}

type SerializedTransaction = Record<string, unknown>;

export const capitalGainsService = {
  async calculate(userId: string, input: CalculateCapitalGainsInput) {
    const { financialYearCode, transactions } = input;

    const years = new Set<string>();
    for (const t of transactions) {
      years.add(financialYearFromDate(t.purchaseDate));
      years.add(financialYearFromDate(t.saleDate));
    }
    const ciiRows = await prisma.costInflationIndex.findMany({ where: { year: { in: [...years] } } });
    const ciiByYear = new Map(ciiRows.map((r) => [r.year, r.ciiValue]));

    const rules = await prisma.taxCapitalGainRule.findMany();
    const ruleByKey = new Map(rules.map((r) => [`${r.assetType}:${r.termType}`, r]));

    const computed: ComputedTransaction[] = transactions.map((t) => {
      const holdingPeriodDays = daysBetween(t.purchaseDate, t.saleDate);
      const termType: CapitalGainTermType =
        holdingPeriodDays > LONG_TERM_THRESHOLD_DAYS[t.assetType] ? "LONG" : "SHORT";
      const rule = ruleByKey.get(`${t.assetType}:${termType}`);

      let indexedCost: number | null = null;
      let costBasis = t.purchasePrice;
      if (rule?.indexationAllowed && termType === "LONG") {
        const purchaseCii = ciiByYear.get(financialYearFromDate(t.purchaseDate));
        const saleCii = ciiByYear.get(financialYearFromDate(t.saleDate));
        if (purchaseCii && saleCii) {
          indexedCost = t.purchasePrice * (saleCii / purchaseCii);
          costBasis = indexedCost;
        }
      }

      const rawGain = t.salePrice - costBasis - t.brokerage - t.stampDuty - t.transferCharges;
      return { input: t, termType, holdingPeriodDays, indexedCost, rawGain, rule };
    });

    // Group by assetType+termType: the exemption limit (e.g. equity LTCG's ₹1,25,000/yr) applies
    // once per group, and the resulting group tax is allocated proportionally across the group's
    // positive-gain transactions (losses within a group net against gains but bear no tax).
    const groups = new Map<string, ComputedTransaction[]>();
    for (const c of computed) {
      const key = `${c.input.assetType}:${c.termType}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    const taxByTransaction = new Map<ComputedTransaction, number>();
    for (const group of groups.values()) {
      const netGroupGain = group.reduce((sum, c) => sum + c.rawGain, 0);
      const rule = group[0].rule;
      const ratePercent = rule ? Number(rule.ratePercent) : 0;
      const exemptionLimit = rule?.exemptionLimit ? Number(rule.exemptionLimit) : 0;
      const taxableGroupGain = Math.max(0, netGroupGain - exemptionLimit);
      const groupTax = taxableGroupGain * (ratePercent / 100);
      const totalPositiveGain = group.reduce((sum, c) => sum + Math.max(0, c.rawGain), 0);
      for (const c of group) {
        const share = totalPositiveGain > 0 ? Math.max(0, c.rawGain) / totalPositiveGain : 0;
        taxByTransaction.set(c, groupTax * share);
      }
    }

    const created: SerializedTransaction[] = [];
    for (const c of computed) {
      const taxAmount = taxByTransaction.get(c) ?? 0;
      const record = await prisma.capitalGainsTransaction.create({
        data: {
          userId,
          financialYearCode,
          assetType: c.input.assetType,
          purchaseDate: c.input.purchaseDate,
          purchasePrice: c.input.purchasePrice,
          saleDate: c.input.saleDate,
          salePrice: c.input.salePrice,
          quantity: c.input.quantity,
          brokerage: c.input.brokerage,
          stampDuty: c.input.stampDuty,
          transferCharges: c.input.transferCharges,
          holdingPeriodDays: c.holdingPeriodDays,
          termType: c.termType,
          indexedCost: c.indexedCost,
          gainAmount: c.rawGain,
          taxAmount,
        },
      });
      created.push(serializeDecimals(record, DECIMAL_FIELDS) as SerializedTransaction);
    }

    await logAudit(userId, "CREATE", "CapitalGainsTransaction", undefined, {
      financialYearCode,
      count: created.length,
    });

    return { transactions: created, summary: summarize(created) };
  },

  async list(userId: string, financialYearCode?: string) {
    const records = await prisma.capitalGainsTransaction.findMany({
      where: { userId, ...(financialYearCode ? { financialYearCode } : {}) },
      orderBy: { saleDate: "desc" },
    });
    const serialized = records.map((r) => serializeDecimals(r, DECIMAL_FIELDS) as SerializedTransaction);
    return { transactions: serialized, summary: summarize(serialized) };
  },

  async remove(userId: string, id: string) {
    const record = await prisma.capitalGainsTransaction.findFirst({ where: { id, userId } });
    if (!record) throw AppError.notFound("Capital gains transaction not found");
    await prisma.capitalGainsTransaction.delete({ where: { id: record.id } });
    await logAudit(userId, "DELETE", "CapitalGainsTransaction", id, {});
  },
};

function summarize(transactions: SerializedTransaction[]) {
  let totalStcg = 0;
  let totalLtcg = 0;
  let totalTax = 0;
  const byAssetType: Record<string, { gain: number; tax: number }> = {};

  for (const t of transactions) {
    const gain = Number(t.gainAmount ?? 0);
    const tax = Number(t.taxAmount ?? 0);
    const assetType = String(t.assetType);
    if (t.termType === "SHORT") totalStcg += gain;
    else totalLtcg += gain;
    totalTax += tax;
    if (!byAssetType[assetType]) byAssetType[assetType] = { gain: 0, tax: 0 };
    byAssetType[assetType].gain += gain;
    byAssetType[assetType].tax += tax;
  }

  return {
    totalStcg,
    totalLtcg,
    totalGain: totalStcg + totalLtcg,
    totalTax,
    netProfit: totalStcg + totalLtcg - totalTax,
    byAssetType,
  };
}
