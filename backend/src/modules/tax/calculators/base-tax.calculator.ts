import { TaxAgeCategory } from "@prisma/client";
import {
  DeductionApplied,
  IncomeBreakdown,
  RegimeResult,
  RegimeRuleSet,
  TaxCalculationInput,
  TaxCalculator,
} from "./tax-calculator.types";
import {
  capHousePropertyLossForSetOff,
  computeCapitalGainsTax,
  computeCess,
  computeHouseProperty,
  computeRebate,
  computeSalaryIncome,
  computeSlabTax,
  computeSurcharge,
  resolveAgeCategory,
} from "./calculation-helpers.util";

/** Shared orchestration for both regimes (Template Method) — the parts that genuinely differ
 * between Old and New regime (which deductions apply, HRA/self-occupied-interest/loss-set-off
 * eligibility, and which age-banded slab table to use) are delegated to small `protected abstract`
 * hooks implemented by `OldRegimeCalculator` / `NewRegimeCalculator`. This keeps the Strategy
 * pattern (`TaxCalculator`) genuinely swappable while avoiding duplicating ~150 lines of
 * income-aggregation plumbing between the two concrete strategies. */
export abstract class BaseTaxCalculator implements TaxCalculator {
  abstract readonly regime: TaxCalculator["regime"];

  protected abstract allowHraExemption(): boolean;
  protected abstract allowSelfOccupiedInterest(): boolean;
  protected abstract allowHousePropertyLossSetOff(): boolean;
  protected abstract ageCategoryForSlabs(age: number): TaxAgeCategory;
  protected abstract computeDeductions(input: TaxCalculationInput, rules: RegimeRuleSet): DeductionApplied[];

  calculate(input: TaxCalculationInput, rules: RegimeRuleSet): RegimeResult {
    const salaryResult = computeSalaryIncome(
      input.salary,
      input.deductions.employerNpsContribution,
      input.personal.state,
      this.allowHraExemption()
    );

    const houseResult = computeHouseProperty(input.houseProperty, this.allowSelfOccupiedInterest());
    const housePropertyIncome = capHousePropertyLossForSetOff(houseResult.incomeOrLoss, this.allowHousePropertyLossSetOff());

    const capitalGains = computeCapitalGainsTax(input.capitalGains);

    const otherSourcesIncome =
      input.otherIncome.savingsInterest +
      input.otherIncome.fdInterest +
      input.otherIncome.rdInterest +
      input.otherIncome.dividendIncome +
      input.otherIncome.familyPension +
      input.otherIncome.otherSourcesIncome +
      // Agriculture income remains exempt from income tax under Indian law (only used for
      // "partial integration" rate calculation on other income, which is out of scope here).
      0 +
      capitalGains.debtStcgAddedToSlabIncome;

    const businessIncome =
      input.businessIncome.businessProfit + input.businessIncome.professionalIncome + input.businessIncome.presumptiveIncome;

    const incomeBreakdown: IncomeBreakdown = {
      salaryIncome: salaryResult.taxableSalaryBeforeStandardDeduction,
      housePropertyIncome,
      otherSourcesIncome,
      businessIncome,
      capitalGainsSlabTaxed: capitalGains.debtStcgAddedToSlabIncome,
      grossTotalIncome:
        salaryResult.taxableSalaryBeforeStandardDeduction + housePropertyIncome + otherSourcesIncome + businessIncome,
    };

    const deductionsApplied = this.computeDeductions(input, rules);
    const totalDeductions = deductionsApplied.reduce((sum, d) => sum + d.allowed, 0);

    const taxableIncome = Math.max(0, incomeBreakdown.grossTotalIncome - totalDeductions);

    const ageCategory = this.ageCategoryForSlabs(input.personal.age);
    const slabs = rules.slabsByAge[ageCategory] ?? rules.slabsByAge.GENERAL;
    const { total: taxOnSlabIncome, rows: slabTaxBreakdown } = computeSlabTax(taxableIncome, slabs);

    const rebateAmount = computeRebate(taxableIncome, taxOnSlabIncome, rules.rebate);
    const taxAfterRebate = Math.max(0, taxOnSlabIncome - rebateAmount);

    const taxBeforeRebate = taxOnSlabIncome + capitalGains.totalSpecialRateTax;
    // Section 87A rebate applies only to tax on normal slab-taxed income, never to special-rate
    // capital gains / crypto tax (per CBDT rules) — so we add special-rate tax back in after rebate.
    const taxAfterRebateIncludingSpecialRate = taxAfterRebate + capitalGains.totalSpecialRateTax;

    // Surcharge bands are evaluated on total (taxable) income.
    const { amount: surchargeAmount, marginalRelief } = computeSurcharge(
      taxableIncome,
      taxAfterRebateIncludingSpecialRate,
      rules.surcharge
    );

    const taxAfterSurcharge = taxAfterRebateIncludingSpecialRate + surchargeAmount;

    const cessRate = rules.cess[0]?.ratePercent ?? 4;
    const cessAmount = computeCess(taxAfterSurcharge, cessRate);

    const totalTaxPayable = Math.round(taxAfterSurcharge + cessAmount);
    const effectiveTaxRatePercent =
      incomeBreakdown.grossTotalIncome > 0 ? (totalTaxPayable / incomeBreakdown.grossTotalIncome) * 100 : 0;

    return {
      regime: this.regime,
      incomeBreakdown,
      deductionsApplied,
      totalDeductions,
      taxableIncome,
      slabTaxBreakdown,
      taxOnSlabIncome,
      capitalGainsTax: capitalGains,
      taxBeforeRebate,
      rebateAmount,
      taxAfterRebate: taxAfterRebateIncludingSpecialRate,
      surchargeAmount,
      taxAfterSurcharge,
      marginalReliefApplied: marginalRelief,
      cessAmount,
      totalTaxPayable,
      effectiveTaxRatePercent,
      takeHomeIncome: incomeBreakdown.grossTotalIncome - totalTaxPayable,
    };
  }

  /** Shared helper for concrete strategies: look up a DB-driven deduction rule and clamp the
   * user-claimed amount to its `maxLimit` (or 0 if the regime disallows it). */
  protected applyDeduction(rules: RegimeRuleSet, code: string, claimed: number): DeductionApplied {
    const rule = rules.deductions[code];
    if (!rule || !rule.isAllowed || claimed <= 0) {
      return { code, label: rule?.label ?? code, claimed: Math.max(0, claimed), allowed: 0 };
    }
    const allowed = rule.maxLimit === null ? claimed : Math.min(claimed, rule.maxLimit);
    return { code, label: rule.label, claimed, allowed };
  }

  /** Percentage-of-basic-salary deduction (used for Section 80CCD(2) — employer NPS contribution). */
  protected applyPercentDeduction(rules: RegimeRuleSet, code: string, claimed: number, basicSalary: number): DeductionApplied {
    const rule = rules.deductions[code];
    if (!rule || !rule.isAllowed || claimed <= 0) {
      return { code, label: rule?.label ?? code, claimed: Math.max(0, claimed), allowed: 0 };
    }
    const cap = rule.ratePercent !== null ? basicSalary * (rule.ratePercent / 100) : Infinity;
    const allowed = Math.min(claimed, cap);
    return { code, label: rule.label, claimed, allowed };
  }
}
