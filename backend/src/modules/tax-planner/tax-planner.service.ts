import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { logAudit } from "../../utils/audit-log.util";
import { taxService } from "../tax/tax.service";
import { taxRulesService } from "../tax/tax-rules.service";
import { TaxCalculationInput } from "../tax/calculators/tax-calculator.types";
import { generateStructuredSuggestions } from "./tax-planner-suggestions.util";
import { GenerateTaxPlanInput } from "./tax-planner.dto";

export const taxPlannerService = {
  async generatePlan(userId: string, input: GenerateTaxPlanInput) {
    let taxInput = input.taxInput as TaxCalculationInput | undefined;

    if (!taxInput) {
      const latest = await prisma.taxCalculation.findFirst({
        where: { userId, financialYearCode: input.financialYearCode },
        orderBy: { createdAt: "desc" },
      });
      if (!latest) {
        throw AppError.badRequest(
          "No saved tax calculation found for this financial year. Provide calculation inputs or save a calculation first."
        );
      }
      taxInput = latest.inputs as unknown as TaxCalculationInput;
    }

    const [comparison, rules] = await Promise.all([
      taxService.calculate(taxInput),
      taxRulesService.getFinancialYearRuleSet(input.financialYearCode),
    ]);

    const suggestions = generateStructuredSuggestions(taxInput, comparison.old, rules);

    const saved = await prisma.taxSavingPlan.create({
      data: {
        userId,
        financialYearCode: input.financialYearCode,
        inputs: JSON.parse(JSON.stringify(taxInput)),
        suggestions: JSON.parse(JSON.stringify(suggestions)),
      },
    });

    await logAudit(userId, "CREATE", "TaxSavingPlan", saved.id, { financialYearCode: input.financialYearCode });

    return { id: saved.id, financialYearCode: input.financialYearCode, suggestions, comparison };
  },

  async list(userId: string, financialYearCode?: string) {
    const rows = await prisma.taxSavingPlan.findMany({
      where: { userId, ...(financialYearCode ? { financialYearCode } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      financialYearCode: r.financialYearCode,
      createdAt: r.createdAt,
      suggestions: r.suggestions,
    }));
  },

  async getLatest(userId: string, financialYearCode: string) {
    const latest = await prisma.taxSavingPlan.findFirst({
      where: { userId, financialYearCode },
      orderBy: { createdAt: "desc" },
    });
    return latest
      ? { id: latest.id, financialYearCode: latest.financialYearCode, createdAt: latest.createdAt, suggestions: latest.suggestions }
      : null;
  },
};
