import { RegimeResult, TaxFinancialYearRuleSet } from "./calculators/tax-calculator.types";

/**
 * Generates human-readable tax-saving suggestions by comparing what a taxpayer actually claimed
 * against the DB-configured limits for the Old Regime (the only regime where most Chapter VI-A
 * deductions apply). Entirely data-driven — no section limit is hardcoded here either.
 */
export function generateTaxSavingSuggestions(oldResult: RegimeResult, newResult: RegimeResult, rules: TaxFinancialYearRuleSet): string[] {
  const suggestions: string[] = [];
  const findDeduction = (code: string) => oldResult.deductionsApplied.find((d) => d.code === code);
  const rule = (code: string) => rules.old.deductions[code];

  const sec80C = findDeduction("SEC_80C");
  const sec80CRule = rule("SEC_80C");
  if (sec80C && sec80CRule?.isAllowed && sec80CRule.maxLimit !== null && sec80C.claimed < sec80CRule.maxLimit) {
    const gap = sec80CRule.maxLimit - sec80C.claimed;
    suggestions.push(
      `You can invest ₹${gap.toLocaleString("en-IN")} more in PPF/ELSS/EPF to fully utilize your Section 80C limit of ₹${sec80CRule.maxLimit.toLocaleString("en-IN")} (Old Regime only).`
    );
  }

  const nps = findDeduction("SEC_80CCD_1B");
  const npsRule = rule("SEC_80CCD_1B");
  if (nps && npsRule?.isAllowed && npsRule.maxLimit !== null && nps.claimed < npsRule.maxLimit) {
    suggestions.push(
      `Contributing ₹${(npsRule.maxLimit - nps.claimed).toLocaleString("en-IN")} more to NPS under Section 80CCD(1B) can reduce your taxable income by up to ₹${npsRule.maxLimit.toLocaleString("en-IN")} (Old Regime only).`
    );
  }

  const health = findDeduction("SEC_80D_SELF_NON_SENIOR") ?? findDeduction("SEC_80D_SELF_SENIOR");
  const healthRule = rule("SEC_80D_SELF_NON_SENIOR") ?? rule("SEC_80D_SELF_SENIOR");
  if (health && healthRule?.isAllowed && healthRule.maxLimit !== null && health.claimed < healthRule.maxLimit) {
    suggestions.push(
      `A health insurance policy claiming the full ₹${healthRule.maxLimit.toLocaleString("en-IN")} under Section 80D would further reduce your Old Regime tax liability.`
    );
  }

  const homeLoan = oldResult.incomeBreakdown.housePropertyIncome < 0;
  if (!homeLoan) {
    suggestions.push("If you have a home loan, claiming interest under Section 24(b) can reduce your Old Regime taxable income by up to ₹2,00,000.");
  }

  if (oldResult.totalTaxPayable < newResult.totalTaxPayable) {
    suggestions.push(
      `Based on your current deductions, the Old Regime saves you ₹${(newResult.totalTaxPayable - oldResult.totalTaxPayable).toLocaleString("en-IN")} compared to the New Regime.`
    );
  } else if (newResult.totalTaxPayable < oldResult.totalTaxPayable) {
    suggestions.push(
      `The New Regime currently saves you ₹${(oldResult.totalTaxPayable - newResult.totalTaxPayable).toLocaleString("en-IN")} — claiming more deductions under the Old Regime may change this.`
    );
  }

  if (suggestions.length === 0) {
    suggestions.push("You are already utilizing your available deductions well for this financial year.");
  }

  return suggestions;
}
