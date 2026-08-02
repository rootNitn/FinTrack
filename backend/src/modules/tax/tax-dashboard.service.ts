import { prisma } from "../../config/prisma";
import { TaxComparisonResult } from "./calculators/tax-calculator.types";
import { reconciliationService } from "../reconciliation/reconciliation.service";
import { taxPlannerService } from "../tax-planner/tax-planner.service";
import { buildTaxAiInsights } from "./tax-ai-insights.util";
import { StructuredTaxSavingSuggestion } from "../tax-planner/tax-planner-suggestions.util";

function toNumber(value: { toNumber: () => number } | null | undefined): number | null {
  return value ? value.toNumber() : null;
}

export const taxDashboardService = {
  /**
   * Aggregates the latest saved Tax Calculation, Form 26AS, Advance Tax run and Tax Saving Plan
   * for a financial year into a single dashboard payload, plus a rule-based AI Insights feed.
   * Read-only — never creates new saved records (uses whatever the user has already saved).
   */
  async getDashboard(userId: string, financialYearCode: string) {
    const [latestCalculation, form26as, latestAdvanceTax, latestPlan, reconciliation] = await Promise.all([
      prisma.taxCalculation.findFirst({ where: { userId, financialYearCode }, orderBy: { createdAt: "desc" } }),
      prisma.form26ASRecord.findFirst({ where: { userId, financialYearCode }, orderBy: { createdAt: "desc" } }),
      prisma.advanceTaxCalculation.findFirst({ where: { userId, financialYearCode }, orderBy: { createdAt: "desc" } }),
      taxPlannerService.getLatest(userId, financialYearCode),
      reconciliationService.getReport(userId, financialYearCode),
    ]);

    const comparison = latestCalculation ? (latestCalculation.result as unknown as TaxComparisonResult) : null;
    const totalTaxPaid = toNumber(form26as?.totalTaxPaid);
    const suggestions = (latestPlan?.suggestions as unknown as StructuredTaxSavingSuggestion[]) ?? [];

    const insights = buildTaxAiInsights({
      comparison,
      reconciliationWarnings: [...reconciliation.aisWarnings, ...reconciliation.form26asWarnings],
      totalTaxPaid,
      suggestions,
    });

    const recommended = comparison ? comparison[comparison.recommendedRegime === "OLD" ? "old" : "new"] : null;
    const advanceTaxResult = latestAdvanceTax?.result as { totalPayable?: number; totalInterest?: number } | undefined;

    return {
      financialYearCode,
      calculation: latestCalculation && comparison && recommended
        ? {
            id: latestCalculation.id,
            createdAt: latestCalculation.createdAt,
            recommendedRegime: comparison.recommendedRegime,
            totalTaxPayable: recommended.totalTaxPayable,
            taxSaved: comparison.taxSaved,
            takeHomeIncome: recommended.takeHomeIncome,
          }
        : null,
      form26as: form26as
        ? {
            totalTaxPaid,
            refund: toNumber(form26as.refund),
          }
        : null,
      advanceTax: latestAdvanceTax
        ? {
            id: latestAdvanceTax.id,
            totalPayable: advanceTaxResult?.totalPayable ?? null,
            totalInterest: advanceTaxResult?.totalInterest ?? null,
          }
        : null,
      taxSavingPlan: latestPlan
        ? {
            id: latestPlan.id,
            topSuggestions: suggestions.slice(0, 3),
          }
        : null,
      insights,
    };
  },
};
