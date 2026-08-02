import { TaxComparisonResult } from "./calculators/tax-calculator.types";
import { StructuredTaxSavingSuggestion } from "../tax-planner/tax-planner-suggestions.util";

export interface TaxAiInsight {
  id: string;
  severity: "info" | "warning" | "success";
  title: string;
  message: string;
}

/**
 * Rule-based (non-LLM) AI Insights feed for the Tax Dashboard. Combines the regime
 * recommendation, document-reconciliation mismatches, refund/shortfall detection, and the
 * top Tax Saving Planner suggestions into a single prioritized list.
 */
export function buildTaxAiInsights(params: {
  comparison: TaxComparisonResult | null;
  reconciliationWarnings: string[];
  totalTaxPaid: number | null;
  suggestions: StructuredTaxSavingSuggestion[];
}): TaxAiInsight[] {
  const { comparison, reconciliationWarnings, totalTaxPaid, suggestions } = params;
  const insights: TaxAiInsight[] = [];

  if (comparison) {
    const recommended = comparison[comparison.recommendedRegime === "OLD" ? "old" : "new"];
    if (comparison.taxSaved > 0) {
      insights.push({
        id: "regime-recommendation",
        severity: "success",
        title: `${comparison.recommendedRegime === "OLD" ? "Old" : "New"} Regime is better for you`,
        message: `You save ₹${comparison.taxSaved.toLocaleString("en-IN")} by choosing the ${
          comparison.recommendedRegime === "OLD" ? "Old" : "New"
        } Regime for FY ${comparison.financialYearCode}.`,
      });
    }

    if (totalTaxPaid !== null) {
      const diff = totalTaxPaid - recommended.totalTaxPayable;
      if (diff > 500) {
        insights.push({
          id: "refund-eligible",
          severity: "success",
          title: "You may be eligible for a refund",
          message: `Tax already paid (₹${totalTaxPaid.toLocaleString("en-IN")}) exceeds your computed liability (₹${recommended.totalTaxPayable.toLocaleString(
            "en-IN",
          )}) by ₹${diff.toLocaleString("en-IN")}.`,
        });
      } else if (diff < -500) {
        insights.push({
          id: "additional-tax-due",
          severity: "warning",
          title: "Additional tax may be due",
          message: `Your computed liability (₹${recommended.totalTaxPayable.toLocaleString(
            "en-IN",
          )}) exceeds tax already paid (₹${totalTaxPaid.toLocaleString("en-IN")}) by ₹${Math.abs(diff).toLocaleString("en-IN")}.`,
        });
      }
    }
  }

  reconciliationWarnings.slice(0, 5).forEach((message, index) => {
    insights.push({
      id: `reconciliation-${index}`,
      severity: "warning",
      title: "Document mismatch detected",
      message,
    });
  });

  suggestions
    .slice(0, 3)
    .filter((s) => s.potentialTaxSaving > 0)
    .forEach((s) => {
      insights.push({
        id: `suggestion-${s.code}`,
        severity: "info",
        title: s.title,
        message: s.description,
      });
    });

  return insights;
}
