import { TaxRegimeType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { buildPaginationMeta } from "../../utils/pagination";
import { TaxCalculator } from "./calculators/tax-calculator";
import { RegimeResult, TaxCalculationInput, TaxComparisonResult } from "./calculators/tax-calculator.types";
import { taxRulesService } from "./tax-rules.service";
import { generateTaxSavingSuggestions } from "./tax-suggestions.util";
import { CalculateTaxInput, HistoryQuery, SaveTaxCalculationInput, WhatIfTaxInput } from "./tax.dto";

export const taxService = {
  async calculate(input: CalculateTaxInput): Promise<TaxComparisonResult> {
    const rules = await taxRulesService.getFinancialYearRuleSet(input.financialYearCode);

    const old = TaxCalculator.calculate("OLD", input as TaxCalculationInput, rules.old);
    const newRegime = TaxCalculator.calculate("NEW", input as TaxCalculationInput, rules.new);

    const recommendedRegime: TaxRegimeType = old.totalTaxPayable <= newRegime.totalTaxPayable ? "OLD" : "NEW";
    const taxSaved = Math.abs(old.totalTaxPayable - newRegime.totalTaxPayable);
    const suggestions = generateTaxSavingSuggestions(old, newRegime, rules);

    return {
      financialYearCode: rules.financialYearCode,
      old,
      new: newRegime,
      recommendedRegime,
      taxSaved,
      suggestions,
    };
  },

  /** What-If Analysis — applies ad-hoc overrides (80C, NPS, health insurance, home loan interest,
   * HRA/rent) on top of the base input and instantly recalculates both regimes, without persisting
   * anything. Reuses the exact same calculation engine as `calculate`, so results stay consistent. */
  async whatIf(input: WhatIfTaxInput): Promise<TaxComparisonResult> {
    const overrides = input.overrides ?? {};
    const adjusted: CalculateTaxInput = {
      ...input,
      salary: {
        ...input.salary,
        hraReceived: overrides.hraReceived ?? input.salary.hraReceived,
        rentPaid: overrides.rentPaid ?? input.salary.rentPaid,
      },
      houseProperty: {
        ...input.houseProperty,
        homeLoanInterest: overrides.homeLoanInterest ?? input.houseProperty.homeLoanInterest,
      },
      deductions: {
        ...input.deductions,
        section80C: overrides.section80C ?? input.deductions.section80C,
        section80CCD1B: overrides.section80CCD1B ?? input.deductions.section80CCD1B,
        section80DSelf: overrides.section80DSelf ?? input.deductions.section80DSelf,
      },
    };
    return this.calculate(adjusted);
  },

  async getSlabs(financialYearCode?: string) {
    const code = financialYearCode ?? (await taxRulesService.getDefaultFinancialYearCode());
    return taxRulesService.getFinancialYearRuleSet(code);
  },

  async listFinancialYears() {
    return taxRulesService.listFinancialYears();
  },

  async save(userId: string, input: SaveTaxCalculationInput) {
    return prisma.taxCalculation.create({
      data: {
        userId,
        financialYearCode: input.financialYearCode,
        label: input.label ?? null,
        selectedRegime: input.selectedRegime ?? null,
        inputs: input.inputs,
        result: input.result as object,
      },
    });
  },

  async history(userId: string, query: HistoryQuery) {
    const [items, total] = await Promise.all([
      prisma.taxCalculation.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.taxCalculation.count({ where: { userId } }),
    ]);
    return { items, meta: buildPaginationMeta(total, query.page, query.limit) };
  },

  async getHistoryItem(userId: string, id: string) {
    const item = await prisma.taxCalculation.findFirst({ where: { id, userId } });
    if (!item) throw AppError.notFound("Saved calculation not found");
    return item;
  },

  async deleteHistoryItem(userId: string, id: string) {
    const item = await prisma.taxCalculation.findFirst({ where: { id, userId } });
    if (!item) throw AppError.notFound("Saved calculation not found");
    await prisma.taxCalculation.delete({ where: { id } });
  },
};

export type { RegimeResult, TaxComparisonResult };
