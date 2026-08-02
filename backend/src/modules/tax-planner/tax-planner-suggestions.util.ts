import { RegimeResult, TaxCalculationInput, TaxFinancialYearRuleSet } from "../tax/calculators/tax-calculator.types";
import { computeHraExemptionDetailed } from "../tax/calculators/calculation-helpers.util";

export interface StructuredTaxSavingSuggestion {
  code: string;
  title: string;
  description: string;
  investmentRequired: number;
  potentialTaxSaving: number;
  taxSaved: number;
  priorityScore: number;
}

/** Approximates the marginal old-regime slab rate (the rate at which one more rupee of
 * deduction actually saves tax) from the last slab row hit, falling back to the effective rate. */
function marginalRatePercent(oldResult: RegimeResult): number {
  const rows = oldResult.slabTaxBreakdown;
  if (rows.length === 0) return oldResult.effectiveTaxRatePercent;
  return rows[rows.length - 1].ratePercent;
}

function deductionGapSuggestion(
  code: string,
  title: string,
  descriptionFor: (gap: number, limit: number) => string,
  oldResult: RegimeResult,
  rules: TaxFinancialYearRuleSet,
  marginalRate: number
): StructuredTaxSavingSuggestion | null {
  const rule = rules.old.deductions[code];
  if (!rule?.isAllowed || rule.maxLimit === null) return null;
  const claimed = oldResult.deductionsApplied.find((d) => d.code === code)?.claimed ?? 0;
  const gap = rule.maxLimit - claimed;
  if (gap <= 0) return null;
  const potentialTaxSaving = gap * (marginalRate / 100);
  return {
    code,
    title,
    description: descriptionFor(gap, rule.maxLimit),
    investmentRequired: gap,
    potentialTaxSaving,
    taxSaved: potentialTaxSaving,
    priorityScore: 0, // assigned after sorting, see generateStructuredSuggestions
  };
}

export function generateStructuredSuggestions(
  taxInput: TaxCalculationInput,
  oldResult: RegimeResult,
  rules: TaxFinancialYearRuleSet
): StructuredTaxSavingSuggestion[] {
  const marginalRate = marginalRatePercent(oldResult);
  const suggestions: StructuredTaxSavingSuggestion[] = [];

  const sec80C = deductionGapSuggestion(
    "SEC_80C",
    "Maximize Section 80C investments",
    (gap, limit) =>
      `Invest ₹${gap.toLocaleString("en-IN")} more in PPF/ELSS/EPF/life insurance/tax-saving FD to fully use your ₹${limit.toLocaleString("en-IN")} Section 80C limit (Old Regime only).`,
    oldResult,
    rules,
    marginalRate
  );
  if (sec80C) suggestions.push(sec80C);

  const nps1B = deductionGapSuggestion(
    "SEC_80CCD_1B",
    "Contribute more to NPS (80CCD(1B))",
    (gap, limit) =>
      `Contribute ₹${gap.toLocaleString("en-IN")} more to NPS under Section 80CCD(1B) to fully use the ₹${limit.toLocaleString("en-IN")} additional limit (Old Regime only, over and above 80C).`,
    oldResult,
    rules,
    marginalRate
  );
  if (nps1B) suggestions.push(nps1B);

  const isSelfSenior = taxInput.deductions.isSelfOrFamilySenior;
  const healthSelfCode = isSelfSenior ? "SEC_80D_SELF_SENIOR" : "SEC_80D_SELF_NON_SENIOR";
  const health = deductionGapSuggestion(
    healthSelfCode,
    "Buy/top-up health insurance (80D - Self & Family)",
    (gap, limit) =>
      `A health insurance premium of ₹${gap.toLocaleString("en-IN")} more would fully use your ₹${limit.toLocaleString("en-IN")} Section 80D self/family limit (Old Regime only).`,
    oldResult,
    rules,
    marginalRate
  );
  if (health) suggestions.push(health);

  const isParentsSenior = taxInput.deductions.isParentsSenior;
  const healthParentsCode = isParentsSenior ? "SEC_80D_PARENTS_SENIOR" : "SEC_80D_PARENTS_NON_SENIOR";
  const healthParents = deductionGapSuggestion(
    healthParentsCode,
    "Buy/top-up parents' health insurance (80D)",
    (gap, limit) =>
      `A health insurance premium of ₹${gap.toLocaleString("en-IN")} more for your parents would fully use your ₹${limit.toLocaleString("en-IN")} Section 80D parents limit (Old Regime only).`,
    oldResult,
    rules,
    marginalRate
  );
  if (healthParents) suggestions.push(healthParents);

  // Home loan interest (Sec 24(b)) — informational nudge if no home loan interest is being claimed.
  const homeLoanRule = rules.old.deductions.HOME_LOAN_SELF_OCCUPIED_INTEREST;
  if (homeLoanRule?.isAllowed && taxInput.houseProperty.homeLoanInterest <= 0 && taxInput.houseProperty.type !== "LET_OUT") {
    const limit = homeLoanRule.maxLimit ?? 200000;
    suggestions.push({
      code: "HOME_LOAN_SEC_24B",
      title: "Consider a home loan for Section 24(b) interest deduction",
      description: `Home loan interest on a self-occupied property is deductible up to ₹${limit.toLocaleString("en-IN")}/year under Section 24(b) (Old Regime only).`,
      investmentRequired: 0,
      potentialTaxSaving: limit * (marginalRate / 100),
      taxSaved: 0,
      priorityScore: 0,
    });
  }

  // Section 80E (education loan interest) — no monetary cap, purely informational if unused.
  if (rules.old.deductions.SEC_80E?.isAllowed && taxInput.deductions.section80E <= 0) {
    suggestions.push({
      code: "SEC_80E",
      title: "Education loan interest is fully deductible (80E)",
      description: "If you or a family member has an education loan, the full interest paid (no upper limit) is deductible for 8 years under Section 80E (Old Regime only).",
      investmentRequired: 0,
      potentialTaxSaving: 0,
      taxSaved: 0,
      priorityScore: 0,
    });
  }

  // Section 80G (donations) — no fixed cap, purely informational if unused.
  if (rules.old.deductions.SEC_80G?.isAllowed && taxInput.deductions.section80G <= 0) {
    suggestions.push({
      code: "SEC_80G",
      title: "Donations to eligible charities are deductible (80G)",
      description: "Donations to eligible relief funds/charities qualify for 50-100% deduction under Section 80G, subject to qualifying limits (Old Regime only).",
      investmentRequired: 0,
      potentialTaxSaving: 0,
      taxSaved: 0,
      priorityScore: 0,
    });
  }

  // HRA optimization — flag if a meaningful portion of HRA received is currently taxable.
  if (taxInput.salary.hraReceived > 0) {
    const hra = computeHraExemptionDetailed(
      taxInput.salary.basicSalary,
      taxInput.salary.hraReceived,
      taxInput.salary.rentPaid,
      taxInput.personal.state
    );
    if (hra.taxableAmount > 0) {
      suggestions.push({
        code: "HRA_OPTIMIZATION",
        title: "Optimize your HRA exemption",
        description:
          taxInput.salary.rentPaid <= 0
            ? "You are receiving HRA but haven't declared any rent paid — if you pay rent, declaring it (with receipts/rent agreement) can exempt part of your HRA from tax (Old Regime only)."
            : `₹${hra.taxableAmount.toLocaleString("en-IN")} of your HRA is currently taxable. ${hra.formula}`,
        investmentRequired: 0,
        potentialTaxSaving: hra.taxableAmount * (marginalRate / 100),
        taxSaved: 0,
        priorityScore: 0,
      });
    }
  }

  // Employer NPS contribution (80CCD(2)) — allowed in both regimes; percentage-of-salary based cap.
  const npsEmployerRule = rules.old.deductions.SEC_80CCD_2;
  if (npsEmployerRule?.isAllowed && npsEmployerRule.ratePercent) {
    const maxEligible = taxInput.salary.basicSalary * (npsEmployerRule.ratePercent / 100);
    const gap = maxEligible - taxInput.deductions.employerNpsContribution;
    if (gap > 0) {
      suggestions.push({
        code: "SEC_80CCD_2",
        title: "Ask your employer to contribute more to NPS (80CCD(2))",
        description: `Employer NPS contributions up to ${npsEmployerRule.ratePercent}% of basic salary (₹${maxEligible.toLocaleString(
          "en-IN"
        )}) are deductible in BOTH regimes — restructuring ₹${gap.toLocaleString("en-IN")} more of your CTC this way is fully tax-free.`,
        investmentRequired: gap,
        potentialTaxSaving: gap * (marginalRate / 100),
        taxSaved: 0,
        priorityScore: 0,
      });
    }
  }

  // Rank by potential tax saving, descending, and assign a 10-100 priority score.
  suggestions.sort((a, b) => b.potentialTaxSaving - a.potentialTaxSaving);
  suggestions.forEach((s, index) => {
    s.priorityScore = Math.max(10, 100 - index * 10);
  });

  return suggestions;
}
