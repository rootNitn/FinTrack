import { prisma } from "../../config/prisma";
import { runValidationChecks } from "../documents/parsers/validation.util";

function sumDecimal(values: Array<{ toNumber: () => number } | null>): number {
  return values.reduce((total, v) => total + (v ? v.toNumber() : 0), 0);
}

export const reconciliationService = {
  /**
   * Cross-checks the latest AIS record against the user's Salary Slip and Capital Gains
   * transactions for the same financial year, flagging significant mismatches (potential
   * duplicate/omitted income). Never throws — returns warning strings only.
   */
  async reconcileAis(userId: string, financialYearCode: string): Promise<string[]> {
    const ais = await prisma.aisRecord.findFirst({
      where: { userId, financialYearCode },
      orderBy: { createdAt: "desc" },
    });
    if (!ais) return [];

    const [salarySlips, capitalGainsTransactions] = await Promise.all([
      prisma.salarySlipRecord.findMany({ where: { userId, financialYearCode }, select: { grossSalary: true } }),
      prisma.capitalGainsTransaction.findMany({ where: { userId, financialYearCode }, select: { gainAmount: true } }),
    ]);

    const salarySlipTotal = sumDecimal(salarySlips.map((s) => s.grossSalary));
    const capitalGainsTotal = sumDecimal(capitalGainsTransactions.map((c) => c.gainAmount));

    const checks = [];
    if (salarySlips.length > 0) {
      checks.push({
        condition: "AIS_SALARY_MATCHES_SALARY_SLIPS",
        fieldName: "salaryIncome",
        actual: ais.salaryIncome?.toNumber(),
        expected: salarySlipTotal,
        defaultMessage: "AIS Salary Income does not match the total Gross Salary from imported Salary Slips.",
      });
    }
    if (capitalGainsTransactions.length > 0) {
      checks.push({
        condition: "AIS_CAPITAL_GAINS_MATCHES_TRANSACTIONS",
        fieldName: "capitalGainsIncome",
        actual: ais.capitalGainsIncome?.toNumber(),
        expected: capitalGainsTotal,
        defaultMessage: "AIS Capital Gains Income does not match the total gains from recorded Capital Gains transactions.",
      });
    }

    return runValidationChecks("AIS", checks);
  },

  /**
   * Cross-checks the latest Form 26AS record's employer TDS against the sum of TDS deducted
   * across all Form 16 records for the same financial year (an employee may have multiple
   * employers/Form 16s in one FY).
   */
  async reconcileForm26AS(userId: string, financialYearCode: string): Promise<string[]> {
    const form26AS = await prisma.form26ASRecord.findFirst({
      where: { userId, financialYearCode },
      orderBy: { createdAt: "desc" },
    });
    if (!form26AS) return [];

    const form16s = await prisma.form16Record.findMany({
      where: { userId, financialYearCode },
      select: { tdsDeducted: true },
    });
    if (form16s.length === 0) return [];

    const form16TdsTotal = sumDecimal(form16s.map((f) => f.tdsDeducted));

    return runValidationChecks("FORM26AS", [
      {
        condition: "FORM26AS_EMPLOYER_TDS_MATCHES_FORM16",
        fieldName: "employerTds",
        actual: form26AS.employerTds?.toNumber(),
        expected: form16TdsTotal,
        defaultMessage: "Form 26AS Employer TDS does not match the total TDS Deducted across imported Form 16 records.",
      },
    ]);
  },

  async getReport(userId: string, financialYearCode: string) {
    const [aisWarnings, form26asWarnings] = await Promise.all([
      this.reconcileAis(userId, financialYearCode),
      this.reconcileForm26AS(userId, financialYearCode),
    ]);
    return { financialYearCode, aisWarnings, form26asWarnings };
  },
};
