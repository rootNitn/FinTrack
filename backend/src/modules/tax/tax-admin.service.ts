import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import {
  CreateCapitalGainRuleInput,
  CreateCessRuleInput,
  CreateCostInflationIndexInput,
  CreateDeductionRuleInput,
  CreateFinancialYearInput,
  CreateRebateRuleInput,
  CreateSlabInput,
  CreateSurchargeRuleInput,
  CreateValidationRuleInput,
  UpdateCapitalGainRuleInput,
  UpdateCessRuleInput,
  UpdateCostInflationIndexInput,
  UpdateDeductionRuleInput,
  UpdateFinancialYearInput,
  UpdateRebateRuleInput,
  UpdateSlabInput,
  UpdateSurchargeRuleInput,
  UpdateValidationRuleInput,
} from "./tax-admin.dto";

/** Admin CRUD surface for every DB-driven tax rule table — this is the ONLY place slab/rebate/
 * surcharge/cess/deduction values can be created or changed, satisfying the "no hardcoded tax
 * slabs" requirement: a brand-new financial year's Budget changes are added here (or seeded via
 * `prisma/seed-tax.ts`), never by editing calculation code. */
export const taxAdminService = {
  // ---- Financial Years ----
  async listFinancialYears() {
    return prisma.taxFinancialYear.findMany({ orderBy: { startDate: "desc" } });
  },
  async getFinancialYear(id: string) {
    const fy = await prisma.taxFinancialYear.findUnique({
      where: { id },
      include: { slabs: true, rebateRules: true, surchargeRules: true, cessRules: true, deductionRules: true },
    });
    if (!fy) throw AppError.notFound("Financial year not found");
    return fy;
  },
  async createFinancialYear(input: CreateFinancialYearInput) {
    if (input.isDefault) await prisma.taxFinancialYear.updateMany({ data: { isDefault: false }, where: {} });
    return prisma.taxFinancialYear.create({ data: input });
  },
  async updateFinancialYear(id: string, input: UpdateFinancialYearInput) {
    const existing = await prisma.taxFinancialYear.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Financial year not found");
    if (input.isDefault) await prisma.taxFinancialYear.updateMany({ data: { isDefault: false }, where: {} });
    return prisma.taxFinancialYear.update({ where: { id }, data: input });
  },
  async deleteFinancialYear(id: string) {
    const existing = await prisma.taxFinancialYear.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Financial year not found");
    await prisma.taxFinancialYear.delete({ where: { id } });
  },

  // ---- Slabs ----
  async createSlab(input: CreateSlabInput) {
    return prisma.taxSlab.create({ data: input });
  },
  async updateSlab(id: string, input: UpdateSlabInput) {
    const existing = await prisma.taxSlab.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Slab not found");
    return prisma.taxSlab.update({ where: { id }, data: input });
  },
  async deleteSlab(id: string) {
    const existing = await prisma.taxSlab.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Slab not found");
    await prisma.taxSlab.delete({ where: { id } });
  },

  // ---- Rebate rules ----
  async createRebateRule(input: CreateRebateRuleInput) {
    return prisma.taxRebateRule.create({ data: input });
  },
  async updateRebateRule(id: string, input: UpdateRebateRuleInput) {
    const existing = await prisma.taxRebateRule.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Rebate rule not found");
    return prisma.taxRebateRule.update({ where: { id }, data: input });
  },
  async deleteRebateRule(id: string) {
    const existing = await prisma.taxRebateRule.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Rebate rule not found");
    await prisma.taxRebateRule.delete({ where: { id } });
  },

  // ---- Surcharge rules ----
  async createSurchargeRule(input: CreateSurchargeRuleInput) {
    return prisma.taxSurchargeRule.create({ data: input });
  },
  async updateSurchargeRule(id: string, input: UpdateSurchargeRuleInput) {
    const existing = await prisma.taxSurchargeRule.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Surcharge rule not found");
    return prisma.taxSurchargeRule.update({ where: { id }, data: input });
  },
  async deleteSurchargeRule(id: string) {
    const existing = await prisma.taxSurchargeRule.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Surcharge rule not found");
    await prisma.taxSurchargeRule.delete({ where: { id } });
  },

  // ---- Cess rules ----
  async createCessRule(input: CreateCessRuleInput) {
    return prisma.taxCessRule.create({ data: input });
  },
  async updateCessRule(id: string, input: UpdateCessRuleInput) {
    const existing = await prisma.taxCessRule.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Cess rule not found");
    return prisma.taxCessRule.update({ where: { id }, data: input });
  },
  async deleteCessRule(id: string) {
    const existing = await prisma.taxCessRule.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Cess rule not found");
    await prisma.taxCessRule.delete({ where: { id } });
  },

  // ---- Deduction rules ----
  async createDeductionRule(input: CreateDeductionRuleInput) {
    return prisma.taxDeductionRule.create({ data: input });
  },
  async updateDeductionRule(id: string, input: UpdateDeductionRuleInput) {
    const existing = await prisma.taxDeductionRule.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Deduction rule not found");
    return prisma.taxDeductionRule.update({ where: { id }, data: input });
  },
  async deleteDeductionRule(id: string) {
    const existing = await prisma.taxDeductionRule.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Deduction rule not found");
    await prisma.taxDeductionRule.delete({ where: { id } });
  },

  // ---- Capital Gain rules ----
  async listCapitalGainRules() {
    return prisma.taxCapitalGainRule.findMany({ orderBy: [{ assetType: "asc" }, { termType: "asc" }] });
  },
  async createCapitalGainRule(input: CreateCapitalGainRuleInput) {
    return prisma.taxCapitalGainRule.create({ data: input });
  },
  async updateCapitalGainRule(id: string, input: UpdateCapitalGainRuleInput) {
    const existing = await prisma.taxCapitalGainRule.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Capital gain rule not found");
    return prisma.taxCapitalGainRule.update({ where: { id }, data: input });
  },
  async deleteCapitalGainRule(id: string) {
    const existing = await prisma.taxCapitalGainRule.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Capital gain rule not found");
    await prisma.taxCapitalGainRule.delete({ where: { id } });
  },

  // ---- Cost Inflation Index ----
  async listCostInflationIndices() {
    return prisma.costInflationIndex.findMany({ orderBy: { year: "desc" } });
  },
  async createCostInflationIndex(input: CreateCostInflationIndexInput) {
    return prisma.costInflationIndex.create({ data: input });
  },
  async updateCostInflationIndex(id: string, input: UpdateCostInflationIndexInput) {
    const existing = await prisma.costInflationIndex.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Cost Inflation Index entry not found");
    return prisma.costInflationIndex.update({ where: { id }, data: input });
  },
  async deleteCostInflationIndex(id: string) {
    const existing = await prisma.costInflationIndex.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Cost Inflation Index entry not found");
    await prisma.costInflationIndex.delete({ where: { id } });
  },

  // ---- Validation rules ----
  async listValidationRules() {
    return prisma.taxValidationRule.findMany({ orderBy: [{ documentType: "asc" }, { fieldName: "asc" }] });
  },
  async createValidationRule(input: CreateValidationRuleInput) {
    return prisma.taxValidationRule.create({ data: input });
  },
  async updateValidationRule(id: string, input: UpdateValidationRuleInput) {
    const existing = await prisma.taxValidationRule.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Validation rule not found");
    return prisma.taxValidationRule.update({ where: { id }, data: input });
  },
  async deleteValidationRule(id: string) {
    const existing = await prisma.taxValidationRule.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Validation rule not found");
    await prisma.taxValidationRule.delete({ where: { id } });
  },
};
