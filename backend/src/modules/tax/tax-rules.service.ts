import { TaxAgeCategory, TaxRegimeType, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { DeductionRule, RegimeRuleSet, SlabRule, TaxFinancialYearRuleSet } from "./calculators/tax-calculator.types";

function toNumber(value: Prisma.Decimal | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

const AGE_CATEGORIES: TaxAgeCategory[] = ["GENERAL", "SENIOR", "SUPER_SENIOR"];

/**
 * Loads every tax rule (slabs, rebate, surcharge, cess, deductions) for a financial year straight
 * from the database and shapes it into the `RegimeRuleSet` the calculation engine consumes. This
 * is the ONLY place DB rows are translated into calculator input — no slab/limit numbers are ever
 * hardcoded here or anywhere in `calculators/*`.
 */
export const taxRulesService = {
  async getFinancialYearRuleSet(financialYearCode: string): Promise<TaxFinancialYearRuleSet> {
    const financialYear = await prisma.taxFinancialYear.findUnique({
      where: { code: financialYearCode },
      include: {
        slabs: true,
        rebateRules: true,
        surchargeRules: true,
        cessRules: true,
        deductionRules: true,
      },
    });
    if (!financialYear) throw AppError.notFound(`No tax rules configured for financial year ${financialYearCode}`);

    return {
      financialYearCode: financialYear.code,
      label: financialYear.label,
      assessmentYear: financialYear.assessmentYear,
      old: buildRegimeRuleSet(financialYear, "OLD"),
      new: buildRegimeRuleSet(financialYear, "NEW"),
    };
  },

  async getDefaultFinancialYearCode(): Promise<string> {
    const fy =
      (await prisma.taxFinancialYear.findFirst({ where: { isDefault: true, isActive: true } })) ??
      (await prisma.taxFinancialYear.findFirst({ where: { isActive: true }, orderBy: { startDate: "desc" } }));
    if (!fy) throw AppError.notFound("No tax financial years have been configured");
    return fy.code;
  },

  async listFinancialYears() {
    const years = await prisma.taxFinancialYear.findMany({
      where: { isActive: true },
      orderBy: { startDate: "desc" },
    });
    return years.map((y) => ({
      id: y.id,
      code: y.code,
      label: y.label,
      assessmentYear: y.assessmentYear,
      isDefault: y.isDefault,
    }));
  },

  /** Looks up a single `TaxDeductionRule.maxLimit` by financial-year code + rule code (e.g.
   * "GRATUITY_EXEMPTION", "LEAVE_ENCASHMENT_EXEMPTION") — used by the standalone Gratuity/Leave
   * Encashment calculators. Falls back to `fallback` if no FY/rule row is found, so these
   * calculators keep working even before an admin has configured the FY in question. Regime is
   * irrelevant for these two codes (both regimes carry the same limit) so OLD is used arbitrarily. */
  async getDeductionLimit(financialYearCode: string, code: string, fallback: number): Promise<number> {
    const rule = await prisma.taxDeductionRule.findFirst({
      where: { code, regime: "OLD", financialYear: { code: financialYearCode } },
    });
    return rule?.maxLimit ? toNumber(rule.maxLimit)! : fallback;
  },
};

interface FinancialYearWithRules {
  slabs: { regime: TaxRegimeType; ageCategory: TaxAgeCategory; slabOrder: number; minIncome: Prisma.Decimal; maxIncome: Prisma.Decimal | null; ratePercent: Prisma.Decimal }[];
  rebateRules: { regime: TaxRegimeType; thresholdIncome: Prisma.Decimal; maxRebateAmount: Prisma.Decimal; marginalReliefEnabled: boolean }[];
  surchargeRules: {
    regime: TaxRegimeType;
    slabOrder: number;
    minIncome: Prisma.Decimal;
    maxIncome: Prisma.Decimal | null;
    ratePercent: Prisma.Decimal;
    marginalReliefEnabled: boolean;
  }[];
  cessRules: { label: string; ratePercent: Prisma.Decimal }[];
  deductionRules: { regime: TaxRegimeType; code: string; label: string; maxLimit: Prisma.Decimal | null; ratePercent: Prisma.Decimal | null; isAllowed: boolean }[];
}

function buildRegimeRuleSet(fy: FinancialYearWithRules, regime: TaxRegimeType): RegimeRuleSet {
  const slabsByAge = {} as Record<TaxAgeCategory, SlabRule[]>;
  for (const age of AGE_CATEGORIES) {
    slabsByAge[age] = fy.slabs
      .filter((s) => s.regime === regime && s.ageCategory === age)
      .map((s) => ({
        slabOrder: s.slabOrder,
        minIncome: toNumber(s.minIncome) ?? 0,
        maxIncome: s.maxIncome === null ? null : toNumber(s.maxIncome),
        ratePercent: toNumber(s.ratePercent) ?? 0,
      }));
  }
  // New regime never varies by age — fall back to GENERAL for SENIOR/SUPER_SENIOR if not seeded.
  if (regime === "NEW") {
    slabsByAge.SENIOR = slabsByAge.SENIOR.length ? slabsByAge.SENIOR : slabsByAge.GENERAL;
    slabsByAge.SUPER_SENIOR = slabsByAge.SUPER_SENIOR.length ? slabsByAge.SUPER_SENIOR : slabsByAge.GENERAL;
  }

  const rebateRow = fy.rebateRules.find((r) => r.regime === regime) ?? null;
  const rebate = rebateRow
    ? {
        thresholdIncome: toNumber(rebateRow.thresholdIncome) ?? 0,
        maxRebateAmount: toNumber(rebateRow.maxRebateAmount) ?? 0,
        marginalReliefEnabled: rebateRow.marginalReliefEnabled,
      }
    : null;

  const surcharge = fy.surchargeRules
    .filter((s) => s.regime === regime)
    .map((s) => ({
      slabOrder: s.slabOrder,
      minIncome: toNumber(s.minIncome) ?? 0,
      maxIncome: s.maxIncome === null ? null : toNumber(s.maxIncome),
      ratePercent: toNumber(s.ratePercent) ?? 0,
      marginalReliefEnabled: s.marginalReliefEnabled,
    }));

  const cess = fy.cessRules.map((c) => ({ label: c.label, ratePercent: toNumber(c.ratePercent) ?? 0 }));

  const deductions: Record<string, DeductionRule> = {};
  for (const d of fy.deductionRules.filter((row) => row.regime === regime)) {
    deductions[d.code] = {
      code: d.code,
      label: d.label,
      maxLimit: d.maxLimit === null ? null : toNumber(d.maxLimit),
      ratePercent: d.ratePercent === null ? null : toNumber(d.ratePercent),
      isAllowed: d.isAllowed,
    };
  }

  return { regime, slabsByAge, rebate, surcharge, cess, deductions };
}
