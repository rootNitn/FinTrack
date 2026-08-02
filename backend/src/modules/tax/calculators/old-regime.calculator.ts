import { TaxAgeCategory, TaxRegimeType } from "@prisma/client";
import { BaseTaxCalculator } from "./base-tax.calculator";
import { DeductionApplied, RegimeRuleSet, TaxCalculationInput } from "./tax-calculator.types";
import { resolveAgeCategory } from "./calculation-helpers.util";

/** Old (default pre-2020) tax regime strategy — allows the full Chapter VI-A deduction suite,
 * HRA exemption, self-occupied home-loan interest deduction, and inter-head house-property loss
 * set-off. Which deductions/limits actually apply is entirely DB-driven via `RegimeRuleSet`. */
export class OldRegimeCalculator extends BaseTaxCalculator {
  readonly regime: TaxRegimeType = "OLD";

  protected allowHraExemption(): boolean {
    return true;
  }

  protected allowSelfOccupiedInterest(): boolean {
    return true;
  }

  protected allowHousePropertyLossSetOff(): boolean {
    return true;
  }

  protected ageCategoryForSlabs(age: number): TaxAgeCategory {
    return resolveAgeCategory(age);
  }

  protected computeDeductions(input: TaxCalculationInput, rules: RegimeRuleSet): DeductionApplied[] {
    const d = input.deductions;
    // Standard deduction is a fixed statutory amount (not user-entered) — claim "the full limit"
    // whenever the taxpayer has any salary income, and let `applyDeduction` clamp it to the
    // DB-configured `maxLimit` for this financial year.
    const standardDeduction = this.applyDeduction(rules, "STANDARD_DEDUCTION", input.salary.basicSalary > 0 ? Infinity : 0);
    // NOTE: self-occupied home-loan interest is already netted into `housePropertyIncome` by
    // `computeHouseProperty()` in the base calculator (capped there via `allowSelfOccupiedInterest()`),
    // so it is intentionally NOT re-applied as a Chapter VI-A deduction here (that would double-count
    // it). The `HOME_LOAN_SELF_OCCUPIED_INTEREST` DeductionRule row exists purely so the frontend can
    // read `isAllowed` to enable/disable the corresponding input field per regime.

    return [
      standardDeduction,
      this.applyDeduction(rules, "SEC_80C", d.section80C),
      this.applyDeduction(rules, "SEC_80CCD_1B", d.section80CCD1B),
      this.applyDeduction(rules, d.isSelfOrFamilySenior ? "SEC_80D_SELF_SENIOR" : "SEC_80D_SELF_NON_SENIOR", d.section80DSelf),
      this.applyDeduction(rules, d.isParentsSenior ? "SEC_80D_PARENTS_SENIOR" : "SEC_80D_PARENTS_NON_SENIOR", d.section80DParents),
      this.applyDeduction(rules, "SEC_80E", d.section80E),
      this.applyDeduction(rules, "SEC_80G", d.section80G),
      this.applyDeduction(
        rules,
        input.personal.age >= 60 ? "SEC_80TTB" : "SEC_80TTA",
        input.personal.age >= 60
          ? input.otherIncome.savingsInterest + input.otherIncome.fdInterest + input.otherIncome.rdInterest
          : input.otherIncome.savingsInterest
      ),
      this.applyPercentDeduction(rules, "SEC_80CCD_2", d.employerNpsContribution, input.salary.basicSalary),
      this.applyDeduction(rules, "OTHER_DEDUCTIONS", d.otherDeductions),
    ];
  }
}
