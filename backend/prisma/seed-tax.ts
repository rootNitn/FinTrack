/* eslint-disable no-console */
// Standalone seed script for the Income Tax Calculator module — only touches tax_* tables,
// safe to re-run without wiping any other user data. Run with: tsx prisma/seed-tax.ts
//
// IMPORTANT: no tax slab/rebate/surcharge/cess/deduction value is hardcoded anywhere in the
// calculation engine — every number below is the single source of truth and can be edited here
// (or via the Tax Admin UI) without touching any calculator code. Rules for a new financial year
// can be added by inserting a new `TaxFinancialYear` + its child rows.
import { PrismaClient, TaxRegimeType, TaxAgeCategory } from "@prisma/client";

const prisma = new PrismaClient();

type Regime = TaxRegimeType;
const OLD: Regime = "OLD";
const NEW: Regime = "NEW";
const GENERAL: TaxAgeCategory = "GENERAL";
const SENIOR: TaxAgeCategory = "SENIOR";
const SUPER_SENIOR: TaxAgeCategory = "SUPER_SENIOR";

interface SlabInput {
  regime: Regime;
  ageCategory: TaxAgeCategory;
  slabOrder: number;
  minIncome: number;
  maxIncome: number | null;
  ratePercent: number;
}

/** Old-regime slabs are identical across financial years covered here; only the exemption
 * threshold shifts by age band (general / senior 60-80 / super senior 80+). */
function oldRegimeSlabs(): SlabInput[] {
  return [
    // General (< 60)
    { regime: OLD, ageCategory: GENERAL, slabOrder: 1, minIncome: 0, maxIncome: 250000, ratePercent: 0 },
    { regime: OLD, ageCategory: GENERAL, slabOrder: 2, minIncome: 250000, maxIncome: 500000, ratePercent: 5 },
    { regime: OLD, ageCategory: GENERAL, slabOrder: 3, minIncome: 500000, maxIncome: 1000000, ratePercent: 20 },
    { regime: OLD, ageCategory: GENERAL, slabOrder: 4, minIncome: 1000000, maxIncome: null, ratePercent: 30 },
    // Senior citizen (60-80)
    { regime: OLD, ageCategory: SENIOR, slabOrder: 1, minIncome: 0, maxIncome: 300000, ratePercent: 0 },
    { regime: OLD, ageCategory: SENIOR, slabOrder: 2, minIncome: 300000, maxIncome: 500000, ratePercent: 5 },
    { regime: OLD, ageCategory: SENIOR, slabOrder: 3, minIncome: 500000, maxIncome: 1000000, ratePercent: 20 },
    { regime: OLD, ageCategory: SENIOR, slabOrder: 4, minIncome: 1000000, maxIncome: null, ratePercent: 30 },
    // Super senior citizen (80+)
    { regime: OLD, ageCategory: SUPER_SENIOR, slabOrder: 1, minIncome: 0, maxIncome: 500000, ratePercent: 0 },
    { regime: OLD, ageCategory: SUPER_SENIOR, slabOrder: 2, minIncome: 500000, maxIncome: 1000000, ratePercent: 20 },
    { regime: OLD, ageCategory: SUPER_SENIOR, slabOrder: 3, minIncome: 1000000, maxIncome: null, ratePercent: 30 },
  ];
}

/** New-regime slabs do not vary by age — always stored under GENERAL. */
function newRegimeSlabsFy2425(): SlabInput[] {
  return [
    { regime: NEW, ageCategory: GENERAL, slabOrder: 1, minIncome: 0, maxIncome: 300000, ratePercent: 0 },
    { regime: NEW, ageCategory: GENERAL, slabOrder: 2, minIncome: 300000, maxIncome: 600000, ratePercent: 5 },
    { regime: NEW, ageCategory: GENERAL, slabOrder: 3, minIncome: 600000, maxIncome: 900000, ratePercent: 10 },
    { regime: NEW, ageCategory: GENERAL, slabOrder: 4, minIncome: 900000, maxIncome: 1200000, ratePercent: 15 },
    { regime: NEW, ageCategory: GENERAL, slabOrder: 5, minIncome: 1200000, maxIncome: 1500000, ratePercent: 20 },
    { regime: NEW, ageCategory: GENERAL, slabOrder: 6, minIncome: 1500000, maxIncome: null, ratePercent: 30 },
  ];
}

/** New-regime slabs per Budget 2025, effective FY2025-26 (AY2026-27). */
function newRegimeSlabsFy2526(): SlabInput[] {
  return [
    { regime: NEW, ageCategory: GENERAL, slabOrder: 1, minIncome: 0, maxIncome: 400000, ratePercent: 0 },
    { regime: NEW, ageCategory: GENERAL, slabOrder: 2, minIncome: 400000, maxIncome: 800000, ratePercent: 5 },
    { regime: NEW, ageCategory: GENERAL, slabOrder: 3, minIncome: 800000, maxIncome: 1200000, ratePercent: 10 },
    { regime: NEW, ageCategory: GENERAL, slabOrder: 4, minIncome: 1200000, maxIncome: 1600000, ratePercent: 15 },
    { regime: NEW, ageCategory: GENERAL, slabOrder: 5, minIncome: 1600000, maxIncome: 2000000, ratePercent: 20 },
    { regime: NEW, ageCategory: GENERAL, slabOrder: 6, minIncome: 2000000, maxIncome: 2400000, ratePercent: 25 },
    { regime: NEW, ageCategory: GENERAL, slabOrder: 7, minIncome: 2400000, maxIncome: null, ratePercent: 30 },
  ];
}

interface SurchargeInput {
  regime: Regime;
  slabOrder: number;
  minIncome: number;
  maxIncome: number | null;
  ratePercent: number;
}

/** Surcharge bands are the same across the FYs seeded here. New regime surcharge is capped at
 * 25% (no 37% band) per the Budget 2023 change — applies to both old & new regime slabs alike
 * once total income crosses ₹50L. */
function surchargeRules(): SurchargeInput[] {
  return [
    { regime: OLD, slabOrder: 1, minIncome: 5000000, maxIncome: 10000000, ratePercent: 10 },
    { regime: OLD, slabOrder: 2, minIncome: 10000000, maxIncome: 20000000, ratePercent: 15 },
    { regime: OLD, slabOrder: 3, minIncome: 20000000, maxIncome: 50000000, ratePercent: 25 },
    { regime: OLD, slabOrder: 4, minIncome: 50000000, maxIncome: null, ratePercent: 37 },
    { regime: NEW, slabOrder: 1, minIncome: 5000000, maxIncome: 10000000, ratePercent: 10 },
    { regime: NEW, slabOrder: 2, minIncome: 10000000, maxIncome: 20000000, ratePercent: 15 },
    { regime: NEW, slabOrder: 3, minIncome: 20000000, maxIncome: null, ratePercent: 25 },
  ];
}

interface DeductionInput {
  regime: Regime;
  code: string;
  label: string;
  maxLimit: number | null;
  ratePercent: number | null;
  isAllowed: boolean;
}

/** Deduction/exemption catalogue shared by both FYs seeded here. Only a handful survive under
 * the New Regime (standard deduction, employer NPS contribution, gratuity/leave-encashment
 * exemptions) — everything else is flagged `isAllowed: false` so the frontend can auto-disable
 * the corresponding input without any hardcoded regime logic. */
function deductionRules(standardDeductionNewRegime: number): DeductionInput[] {
  return [
    { regime: OLD, code: "STANDARD_DEDUCTION", label: "Standard Deduction", maxLimit: 50000, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "STANDARD_DEDUCTION", label: "Standard Deduction", maxLimit: standardDeductionNewRegime, ratePercent: null, isAllowed: true },

    { regime: OLD, code: "SEC_80C", label: "Section 80C (PPF/EPF/ELSS/Life Insurance/NSC/Tax-saving FD/Home Loan Principal)", maxLimit: 150000, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "SEC_80C", label: "Section 80C", maxLimit: 150000, ratePercent: null, isAllowed: false },

    { regime: OLD, code: "SEC_80CCD_1B", label: "Section 80CCD(1B) - Additional NPS Contribution", maxLimit: 50000, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "SEC_80CCD_1B", label: "Section 80CCD(1B) - Additional NPS Contribution", maxLimit: 50000, ratePercent: null, isAllowed: false },

    { regime: OLD, code: "SEC_80D_SELF_NON_SENIOR", label: "Section 80D - Health Insurance (Self/Family, non-senior)", maxLimit: 25000, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "SEC_80D_SELF_NON_SENIOR", label: "Section 80D - Health Insurance (Self/Family, non-senior)", maxLimit: 25000, ratePercent: null, isAllowed: false },

    { regime: OLD, code: "SEC_80D_SELF_SENIOR", label: "Section 80D - Health Insurance (Self/Family, senior citizen)", maxLimit: 50000, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "SEC_80D_SELF_SENIOR", label: "Section 80D - Health Insurance (Self/Family, senior citizen)", maxLimit: 50000, ratePercent: null, isAllowed: false },

    { regime: OLD, code: "SEC_80D_PARENTS_NON_SENIOR", label: "Section 80D - Health Insurance (Parents, non-senior)", maxLimit: 25000, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "SEC_80D_PARENTS_NON_SENIOR", label: "Section 80D - Health Insurance (Parents, non-senior)", maxLimit: 25000, ratePercent: null, isAllowed: false },

    { regime: OLD, code: "SEC_80D_PARENTS_SENIOR", label: "Section 80D - Health Insurance (Parents, senior citizen)", maxLimit: 50000, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "SEC_80D_PARENTS_SENIOR", label: "Section 80D - Health Insurance (Parents, senior citizen)", maxLimit: 50000, ratePercent: null, isAllowed: false },

    { regime: OLD, code: "SEC_80E", label: "Section 80E - Education Loan Interest", maxLimit: null, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "SEC_80E", label: "Section 80E - Education Loan Interest", maxLimit: null, ratePercent: null, isAllowed: false },

    { regime: OLD, code: "SEC_80G", label: "Section 80G - Donations", maxLimit: null, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "SEC_80G", label: "Section 80G - Donations", maxLimit: null, ratePercent: null, isAllowed: false },

    { regime: OLD, code: "SEC_80TTA", label: "Section 80TTA - Savings Account Interest", maxLimit: 10000, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "SEC_80TTA", label: "Section 80TTA - Savings Account Interest", maxLimit: 10000, ratePercent: null, isAllowed: false },

    { regime: OLD, code: "SEC_80TTB", label: "Section 80TTB - Interest Income (Senior Citizens)", maxLimit: 50000, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "SEC_80TTB", label: "Section 80TTB - Interest Income (Senior Citizens)", maxLimit: 50000, ratePercent: null, isAllowed: false },

    { regime: OLD, code: "SEC_80CCD_2", label: "Section 80CCD(2) - Employer NPS Contribution", maxLimit: null, ratePercent: 10, isAllowed: true },
    { regime: NEW, code: "SEC_80CCD_2", label: "Section 80CCD(2) - Employer NPS Contribution", maxLimit: null, ratePercent: 10, isAllowed: true },

    { regime: OLD, code: "HOME_LOAN_SELF_OCCUPIED_INTEREST", label: "Home Loan Interest (Self-Occupied Property)", maxLimit: 200000, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "HOME_LOAN_SELF_OCCUPIED_INTEREST", label: "Home Loan Interest (Self-Occupied Property)", maxLimit: 200000, ratePercent: null, isAllowed: false },

    { regime: OLD, code: "GRATUITY_EXEMPTION", label: "Gratuity Exemption", maxLimit: 2000000, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "GRATUITY_EXEMPTION", label: "Gratuity Exemption", maxLimit: 2000000, ratePercent: null, isAllowed: true },

    { regime: OLD, code: "LEAVE_ENCASHMENT_EXEMPTION", label: "Leave Encashment Exemption", maxLimit: 2500000, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "LEAVE_ENCASHMENT_EXEMPTION", label: "Leave Encashment Exemption", maxLimit: 2500000, ratePercent: null, isAllowed: true },

    { regime: OLD, code: "EMPLOYER_RETIRAL_EXEMPT_COMBINED", label: "Employer PF + NPS + Superannuation (combined exempt limit)", maxLimit: 750000, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "EMPLOYER_RETIRAL_EXEMPT_COMBINED", label: "Employer PF + NPS + Superannuation (combined exempt limit)", maxLimit: 750000, ratePercent: null, isAllowed: true },

    { regime: OLD, code: "OTHER_DEDUCTIONS", label: "Other Deductions", maxLimit: null, ratePercent: null, isAllowed: true },
    { regime: NEW, code: "OTHER_DEDUCTIONS", label: "Other Deductions", maxLimit: null, ratePercent: null, isAllowed: false },
  ];
}

async function seedFinancialYear(params: {
  code: string;
  label: string;
  assessmentYear: string;
  startDate: Date;
  endDate: Date;
  isDefault: boolean;
  newRegimeSlabs: SlabInput[];
  newRegimeRebate: { thresholdIncome: number; maxRebateAmount: number };
  standardDeductionNewRegime: number;
}) {
  const fy = await prisma.taxFinancialYear.create({
    data: {
      code: params.code,
      label: params.label,
      assessmentYear: params.assessmentYear,
      startDate: params.startDate,
      endDate: params.endDate,
      isDefault: params.isDefault,
      isActive: true,
    },
  });

  const slabs = [...oldRegimeSlabs(), ...params.newRegimeSlabs];
  await prisma.taxSlab.createMany({
    data: slabs.map((s) => ({ ...s, financialYearId: fy.id })),
  });

  await prisma.taxRebateRule.createMany({
    data: [
      { financialYearId: fy.id, regime: OLD, thresholdIncome: 500000, maxRebateAmount: 12500, marginalReliefEnabled: true },
      {
        financialYearId: fy.id,
        regime: NEW,
        thresholdIncome: params.newRegimeRebate.thresholdIncome,
        maxRebateAmount: params.newRegimeRebate.maxRebateAmount,
        marginalReliefEnabled: true,
      },
    ],
  });

  await prisma.taxSurchargeRule.createMany({
    data: surchargeRules().map((s) => ({ ...s, financialYearId: fy.id, marginalReliefEnabled: true })),
  });

  await prisma.taxCessRule.create({
    data: { financialYearId: fy.id, label: "Health & Education Cess", ratePercent: 4 },
  });

  await prisma.taxDeductionRule.createMany({
    data: deductionRules(params.standardDeductionNewRegime).map((d) => ({ ...d, financialYearId: fy.id })),
  });

  console.log(`✅ Seeded tax rules for ${params.label} (${slabs.length} slabs, ${deductionRules(params.standardDeductionNewRegime).length} deduction rules)`);
  return fy;
}

async function main() {
  console.log("🌱 Seeding Income Tax Calculator module...");

  await prisma.taxCalculation.deleteMany();
  await prisma.taxDeductionRule.deleteMany();
  await prisma.taxCessRule.deleteMany();
  await prisma.taxSurchargeRule.deleteMany();
  await prisma.taxRebateRule.deleteMany();
  await prisma.taxSlab.deleteMany();
  await prisma.taxFinancialYear.deleteMany();

  await seedFinancialYear({
    code: "2024-25",
    label: "FY 2024-25",
    assessmentYear: "2025-26",
    startDate: new Date("2024-04-01"),
    endDate: new Date("2025-03-31"),
    isDefault: false,
    newRegimeSlabs: newRegimeSlabsFy2425(),
    newRegimeRebate: { thresholdIncome: 700000, maxRebateAmount: 25000 },
    standardDeductionNewRegime: 75000,
  });

  await seedFinancialYear({
    code: "2025-26",
    label: "FY 2025-26",
    assessmentYear: "2026-27",
    startDate: new Date("2025-04-01"),
    endDate: new Date("2026-03-31"),
    isDefault: true,
    newRegimeSlabs: newRegimeSlabsFy2526(),
    newRegimeRebate: { thresholdIncome: 1200000, maxRebateAmount: 60000 },
    standardDeductionNewRegime: 75000,
  });

  console.log("🎉 Tax module seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
