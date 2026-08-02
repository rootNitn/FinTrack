import { TaxAgeCategory, TaxRegimeType } from "@prisma/client";
import { BaseTaxCalculator } from "./base-tax.calculator";
import { DeductionApplied, RegimeRuleSet, TaxCalculationInput } from "./tax-calculator.types";

/** New (concessional, Section 115BAC) tax regime strategy — disallows almost every Chapter VI-A
 * deduction, the HRA exemption, self-occupied home-loan interest, and inter-head house-property
 * loss set-off. Which deductions survive (standard deduction, employer NPS 80CCD(2), gratuity /
 * leave-encashment exemptions) is driven entirely by the `isAllowed` flag on each financial year's
 * `TaxDeductionRule` rows — this class contains no hardcoded amounts. Age never affects the New
 * Regime slabs, so `ageCategoryForSlabs` always returns `GENERAL`. */
export class NewRegimeCalculator extends BaseTaxCalculator {
  readonly regime: TaxRegimeType = "NEW";

  protected allowHraExemption(): boolean {
    return false;
  }

  protected allowSelfOccupiedInterest(): boolean {
    return false;
  }

  protected allowHousePropertyLossSetOff(): boolean {
    return false;
  }

  protected ageCategoryForSlabs(_age: number): TaxAgeCategory {
    return "GENERAL";
  }

  protected computeDeductions(input: TaxCalculationInput, rules: RegimeRuleSet): DeductionApplied[] {
    const d = input.deductions;
    const standardDeduction = this.applyDeduction(rules, "STANDARD_DEDUCTION", input.salary.basicSalary > 0 ? Infinity : 0);

    // Every other Chapter VI-A section is looked up too (rather than omitted), so that if an
    // admin ever flips `isAllowed = true` for a future financial year, it takes effect with zero
    // code changes here — `applyDeduction` returns `allowed: 0` automatically while disallowed.
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
