import { TaxAgeCategory } from "@prisma/client";
import {
  CapitalGainsInput,
  CapitalGainsTaxBreakdown,
  HousePropertyInput,
  SalaryDetailsInput,
  SlabRule,
  SlabTaxBreakdownRow,
  SurchargeRule,
} from "./tax-calculator.types";

/** Simplified capital-gains tax rates (documented assumption — see PROJECT_OVERVIEW.md):
 * equity STCG flat 20%, equity LTCG exempt first ₹1,25,000/yr then 12.5%, debt LTCG flat 12.5%
 * (no indexation), property/gold gain flat 12.5% (simplified), crypto flat 30% (Sec 115BBH, no
 * loss set-off). Debt STCG is NOT special-rate — it is added to normal slab income. */
const EQUITY_STCG_RATE = 20;
const EQUITY_LTCG_RATE = 12.5;
const EQUITY_LTCG_EXEMPTION = 125000;
const DEBT_LTCG_RATE = 12.5;
const PROPERTY_GAIN_RATE = 12.5;
const GOLD_GAIN_RATE = 12.5;
const CRYPTO_RATE = 30;

/** METRO cities eligible for the 50% (vs 40% non-metro) HRA exemption slab. */
const METRO_STATES = new Set(["Delhi", "Maharashtra", "Tamil Nadu", "West Bengal"]);

export function resolveAgeCategory(age: number): TaxAgeCategory {
  if (age >= 80) return "SUPER_SENIOR";
  if (age >= 60) return "SENIOR";
  return "GENERAL";
}

export interface HraExemptionBreakdown {
  isMetro: boolean;
  hraReceived: number;
  rentMinusTenPercentOfBasic: number;
  percentOfBasicLimit: number;
  percentOfBasicUsed: number;
  exemptAmount: number;
  taxableAmount: number;
  formula: string;
}

/** Section 10(13A) HRA exemption = min(HRA received, rent paid − 10% of basic, 50%/40% of basic).
 * Shared by both the main Tax Calculator (`computeHraExemption`, below) and the standalone HRA
 * Calculator (`backend/src/modules/hra/`), which additionally surfaces this full breakdown. */
export function computeHraExemptionDetailed(
  basicSalary: number,
  hraReceived: number,
  rentPaid: number,
  state: string
): HraExemptionBreakdown {
  const isMetro = METRO_STATES.has(state);
  const percentOfBasicUsed = isMetro ? 0.5 : 0.4;
  const rentMinusTenPercentOfBasic = Math.max(0, rentPaid - 0.1 * basicSalary);
  const percentOfBasicLimit = percentOfBasicUsed * basicSalary;

  const exemptAmount =
    hraReceived <= 0 || rentPaid <= 0 ? 0 : Math.max(0, Math.min(hraReceived, rentMinusTenPercentOfBasic, percentOfBasicLimit));
  const taxableAmount = Math.max(0, hraReceived - exemptAmount);

  return {
    isMetro,
    hraReceived,
    rentMinusTenPercentOfBasic,
    percentOfBasicLimit,
    percentOfBasicUsed: percentOfBasicUsed * 100,
    exemptAmount,
    taxableAmount,
    formula: `min(HRA received ₹${hraReceived.toLocaleString("en-IN")}, Rent paid − 10% of basic ₹${rentMinusTenPercentOfBasic.toLocaleString(
      "en-IN"
    )}, ${(percentOfBasicUsed * 100).toFixed(0)}% of basic ₹${percentOfBasicLimit.toLocaleString("en-IN")}) = ₹${exemptAmount.toLocaleString("en-IN")}`,
  };
}

/** Section 10(13A) HRA exemption = min(HRA received, rent paid − 10% of basic, 50%/40% of basic). */
export function computeHraExemption(salary: SalaryDetailsInput, state: string): number {
  return computeHraExemptionDetailed(salary.basicSalary, salary.hraReceived, salary.rentPaid, state).exemptAmount;
}

/** Gratuity is exempt up to a lifetime limit of ₹20L (simplified vs. the exact
 * 15/26 × last-drawn-salary × years-of-service formula, since years-of-service isn't collected). */
const GRATUITY_EXEMPTION_LIMIT = 2000000;
/** Leave encashment exempt up to ₹25L (revised limit, May 2023). */
const LEAVE_ENCASHMENT_EXEMPTION_LIMIT = 2500000;
/** Employer PF + NPS + superannuation combined exempt up to ₹7.5L/year (Budget 2020); excess taxable. */
const EMPLOYER_RETIRAL_EXEMPT_COMBINED_LIMIT = 750000;

export interface SalaryComputationResult {
  taxableSalaryBeforeStandardDeduction: number;
  hraExemption: number;
  gratuityExempt: number;
  gratuityTaxable: number;
  leaveEncashmentExempt: number;
  leaveEncashmentTaxable: number;
  employerRetiralExemptUsed: number;
  employerRetiralTaxable: number;
}

/** Applies HRA / gratuity / leave-encashment / employer-retiral exemptions (old regime — new
 * regime disallows the HRA exemption only, per Section 115BAC; gratuity/leave-encashment/employer
 * retiral exemptions apply in both regimes since they are exemptions, not Chapter VI-A deductions). */
export function computeSalaryIncome(
  salary: SalaryDetailsInput,
  employerNpsContribution: number,
  state: string,
  allowHraExemption: boolean
): SalaryComputationResult {
  const hraExemption = allowHraExemption ? computeHraExemption(salary, state) : 0;

  const gratuityExempt = Math.min(salary.gratuity, GRATUITY_EXEMPTION_LIMIT);
  const gratuityTaxable = Math.max(0, salary.gratuity - gratuityExempt);

  const leaveEncashmentExempt = Math.min(salary.leaveEncashment, LEAVE_ENCASHMENT_EXEMPTION_LIMIT);
  const leaveEncashmentTaxable = Math.max(0, salary.leaveEncashment - leaveEncashmentExempt);

  const combinedRetiral = salary.employerPf + employerNpsContribution;
  const employerRetiralExemptUsed = Math.min(combinedRetiral, EMPLOYER_RETIRAL_EXEMPT_COMBINED_LIMIT);
  const employerRetiralTaxable = Math.max(0, combinedRetiral - EMPLOYER_RETIRAL_EXEMPT_COMBINED_LIMIT);

  const taxableSalaryBeforeStandardDeduction =
    salary.basicSalary +
    (salary.hraReceived - hraExemption) +
    salary.specialAllowance +
    salary.bonus +
    salary.commission +
    salary.otherAllowances +
    salary.perquisites +
    gratuityTaxable +
    leaveEncashmentTaxable +
    employerRetiralTaxable -
    salary.professionalTax;

  return {
    taxableSalaryBeforeStandardDeduction: Math.max(0, taxableSalaryBeforeStandardDeduction),
    hraExemption,
    gratuityExempt,
    gratuityTaxable,
    leaveEncashmentExempt,
    leaveEncashmentTaxable,
    employerRetiralExemptUsed,
    employerRetiralTaxable,
  };
}

export interface HousePropertyComputationResult {
  netAnnualValue: number;
  standardDeduction30Percent: number;
  interestDeduction: number;
  incomeOrLoss: number;
}

/** House property income/loss. Self-occupied: no rental income; home-loan interest deductible up
 * to ₹2L (old regime only — new regime disallows self-occupied interest entirely). Let-out: NAV =
 * rental − municipal taxes; 30% standard deduction u/s 24(a) + full interest deductible in BOTH
 * regimes; net loss capped at −₹2L set-off against other heads in the OLD regime only (new regime
 * disallows inter-head loss set-off per Sec 115BAC — the cap/disallowance itself is applied by the
 * caller, not here). */
export function computeHouseProperty(
  house: HousePropertyInput,
  allowSelfOccupiedInterest: boolean
): HousePropertyComputationResult {
  if (house.type === "SELF_OCCUPIED") {
    const interestDeduction = allowSelfOccupiedInterest ? Math.min(house.homeLoanInterest, 200000) : 0;
    return { netAnnualValue: 0, standardDeduction30Percent: 0, interestDeduction, incomeOrLoss: -interestDeduction };
  }
  if (house.type === "LET_OUT") {
    const netAnnualValue = Math.max(0, house.rentalIncome - house.municipalTaxes);
    const standardDeduction30Percent = netAnnualValue * 0.3;
    const interestDeduction = house.homeLoanInterest;
    const incomeOrLoss = netAnnualValue - standardDeduction30Percent - interestDeduction;
    return { netAnnualValue, standardDeduction30Percent, interestDeduction, incomeOrLoss };
  }
  return { netAnnualValue: 0, standardDeduction30Percent: 0, interestDeduction: 0, incomeOrLoss: 0 };
}

/** Applies the OLD-regime −₹2L cap on house-property loss set-off against other income heads
 * (the NEW regime disallows inter-head loss set-off entirely per Sec 115BAC). */
export function capHousePropertyLossForSetOff(incomeOrLoss: number, allowLossSetOff: boolean): number {
  if (incomeOrLoss >= 0) return incomeOrLoss;
  if (!allowLossSetOff) return 0;
  return Math.max(incomeOrLoss, -200000);
}

export function computeCapitalGainsTax(gains: CapitalGainsInput): CapitalGainsTaxBreakdown {
  const equityStcgTax = Math.max(0, gains.equityStcg) * (EQUITY_STCG_RATE / 100);
  const taxableEquityLtcg = Math.max(0, gains.equityLtcg - EQUITY_LTCG_EXEMPTION);
  const equityLtcgTax = taxableEquityLtcg * (EQUITY_LTCG_RATE / 100);
  const debtLtcgTax = Math.max(0, gains.debtLtcg) * (DEBT_LTCG_RATE / 100);
  const propertyGainTax = Math.max(0, gains.propertyGain) * (PROPERTY_GAIN_RATE / 100);
  const goldGainTax = Math.max(0, gains.goldGain) * (GOLD_GAIN_RATE / 100);
  const cryptoTax = Math.max(0, gains.cryptoIncome) * (CRYPTO_RATE / 100);

  return {
    equityStcgTax,
    equityLtcgTax,
    debtLtcgTax,
    propertyGainTax,
    goldGainTax,
    cryptoTax,
    totalSpecialRateTax: equityStcgTax + equityLtcgTax + debtLtcgTax + propertyGainTax + goldGainTax + cryptoTax,
    debtStcgAddedToSlabIncome: Math.max(0, gains.debtStcg),
  };
}

/** Applies a DB-driven slab table to a taxable-income amount, returning both the total tax and a
 * row-by-row breakdown (used to render the "Tax Breakdown" table on the frontend). */
export function computeSlabTax(taxableIncome: number, slabs: SlabRule[]): { total: number; rows: SlabTaxBreakdownRow[] } {
  const sorted = [...slabs].sort((a, b) => a.slabOrder - b.slabOrder);
  const rows: SlabTaxBreakdownRow[] = [];
  let total = 0;

  for (const slab of sorted) {
    if (taxableIncome <= slab.minIncome) continue;
    const upper = slab.maxIncome === null ? taxableIncome : Math.min(taxableIncome, slab.maxIncome);
    const taxableInThisSlab = Math.max(0, upper - slab.minIncome);
    if (taxableInThisSlab <= 0) continue;
    const taxForThisSlab = taxableInThisSlab * (slab.ratePercent / 100);
    total += taxForThisSlab;
    rows.push({
      slabLabel:
        slab.maxIncome === null
          ? `Above ₹${slab.minIncome.toLocaleString("en-IN")}`
          : `₹${slab.minIncome.toLocaleString("en-IN")} - ₹${slab.maxIncome.toLocaleString("en-IN")}`,
      minIncome: slab.minIncome,
      maxIncome: slab.maxIncome,
      ratePercent: slab.ratePercent,
      taxableInThisSlab,
      taxForThisSlab,
    });
  }

  return { total, rows };
}

/** Section 87A rebate with marginal relief: if taxable income exceeds the threshold by less than
 * the rebate+tax difference, the rebate is reduced so post-rebate tax never jumps by more than the
 * amount of income crossing the threshold. */
export function computeRebate(
  taxableIncome: number,
  taxOnSlabIncome: number,
  rule: { thresholdIncome: number; maxRebateAmount: number; marginalReliefEnabled: boolean } | null
): number {
  if (!rule || taxableIncome > rule.thresholdIncome) return 0;
  return Math.min(taxOnSlabIncome, rule.maxRebateAmount);
}

/** Surcharge on total income with marginal relief at each threshold, so post-surcharge tax
 * increase never exceeds the amount of income crossing the band. */
export function computeSurcharge(
  totalIncome: number,
  taxBeforeSurcharge: number,
  rules: SurchargeRule[]
): { amount: number; marginalRelief: number } {
  const applicable = [...rules]
    .sort((a, b) => a.slabOrder - b.slabOrder)
    .filter((r) => totalIncome > r.minIncome)
    .pop();

  if (!applicable) return { amount: 0, marginalRelief: 0 };

  const rawSurcharge = taxBeforeSurcharge * (applicable.ratePercent / 100);
  if (!applicable.marginalReliefEnabled) return { amount: rawSurcharge, marginalRelief: 0 };

  const excessOverThreshold = totalIncome - applicable.minIncome;
  const totalWithRawSurcharge = taxBeforeSurcharge + rawSurcharge;
  // Tax+surcharge at the threshold itself is taxBeforeSurcharge (no surcharge applies exactly at
  // the boundary since bands are min-exclusive) — relief caps the increase to excessOverThreshold.
  const maxAllowedIncrease = excessOverThreshold;
  const actualIncrease = totalWithRawSurcharge - taxBeforeSurcharge;
  if (actualIncrease <= maxAllowedIncrease) return { amount: rawSurcharge, marginalRelief: 0 };

  const reliefAmount = actualIncrease - maxAllowedIncrease;
  return { amount: Math.max(0, rawSurcharge - reliefAmount), marginalRelief: reliefAmount };
}

export function computeCess(amount: number, ratePercent: number): number {
  return amount * (ratePercent / 100);
}
