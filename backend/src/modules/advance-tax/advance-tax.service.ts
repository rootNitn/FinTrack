import { prisma } from "../../config/prisma";
import { logAudit } from "../../utils/audit-log.util";
import { CalculateAdvanceTaxInput } from "./advance-tax.dto";

/** Cumulative % of the year's assessed tax due by each quarterly due date (Sec 211). */
const SCHEDULE: { quarter: "Q1" | "Q2" | "Q3" | "Q4"; dueDate: string; cumulativePercent: number; interestMonths: number }[] = [
  { quarter: "Q1", dueDate: "Jun 15", cumulativePercent: 15, interestMonths: 3 },
  { quarter: "Q2", dueDate: "Sep 15", cumulativePercent: 45, interestMonths: 3 },
  { quarter: "Q3", dueDate: "Dec 15", cumulativePercent: 75, interestMonths: 3 },
  { quarter: "Q4", dueDate: "Mar 15", cumulativePercent: 100, interestMonths: 1 },
];

/** Advance tax is only mandatory if the assessed tax (after TDS/TCS) is ₹10,000 or more (Sec 208). */
const ADVANCE_TAX_THRESHOLD = 10000;
const INTEREST_RATE_PER_MONTH = 1; // Sec 234B / 234C: simple interest @ 1% per month (or part thereof).
const MIN_ADVANCE_TAX_PAID_TO_AVOID_234B_PERCENT = 90;

function monthsBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() > from.getDate()) months += 1; // any part of a month counts as a full month
  return Math.max(0, months);
}

export const advanceTaxService = {
  async calculate(userId: string, input: CalculateAdvanceTaxInput) {
    const netAssessedTax = Math.max(0, input.estimatedTaxLiability - input.tdsAlreadyDeducted);
    const advanceTaxApplicable = netAssessedTax >= ADVANCE_TAX_THRESHOLD;

    const paidByQuarter = new Map(input.installments.map((i) => [i.quarter, i.paidAmount]));
    let cumulativePaid = 0;
    const schedule = SCHEDULE.map((row) => {
      cumulativePaid += paidByQuarter.get(row.quarter) ?? 0;
      const requiredCumulativeAmount = netAssessedTax * (row.cumulativePercent / 100);
      const shortfall = Math.max(0, requiredCumulativeAmount - cumulativePaid);
      const interest234C = advanceTaxApplicable ? shortfall * (INTEREST_RATE_PER_MONTH / 100) * row.interestMonths : 0;
      return {
        quarter: row.quarter,
        dueDate: row.dueDate,
        cumulativePercentRequired: row.cumulativePercent,
        requiredCumulativeAmount,
        paidCumulativeAmount: cumulativePaid,
        shortfall,
        interest234C,
      };
    });

    const totalInterest234C = schedule.reduce((sum, row) => sum + row.interest234C, 0);
    const totalAdvanceTaxPaid = cumulativePaid;

    // Sec 234B: interest on the shortfall if total advance tax paid is less than 90% of the
    // assessed tax, computed from 1 April of the assessment year until `asOfDate` (default today).
    const financialYear = await prisma.taxFinancialYear.findUnique({ where: { code: input.financialYearCode } });
    const assessmentYearStart = financialYear
      ? new Date(Date.UTC(financialYear.endDate.getUTCFullYear(), 3, 1))
      : new Date(Date.UTC(new Date().getUTCFullYear(), 3, 1));
    const asOfDate = input.asOfDate ?? new Date();

    const ninetyPercentThreshold = netAssessedTax * (MIN_ADVANCE_TAX_PAID_TO_AVOID_234B_PERCENT / 100);
    const is234BApplicable = advanceTaxApplicable && totalAdvanceTaxPaid < ninetyPercentThreshold;
    const shortfall234B = Math.max(0, netAssessedTax - totalAdvanceTaxPaid);
    const monthsElapsed234B = is234BApplicable ? monthsBetween(assessmentYearStart, asOfDate) : 0;
    const interest234B = is234BApplicable ? shortfall234B * (INTEREST_RATE_PER_MONTH / 100) * monthsElapsed234B : 0;

    const result = {
      netAssessedTax,
      advanceTaxApplicable,
      totalAdvanceTaxPaid,
      schedule,
      interest234C: totalInterest234C,
      interest234B: {
        applicable: is234BApplicable,
        shortfall: shortfall234B,
        monthsElapsed: monthsElapsed234B,
        amount: interest234B,
      },
      totalInterest: totalInterest234C + interest234B,
      totalPayable: netAssessedTax - totalAdvanceTaxPaid + totalInterest234C + interest234B,
    };

    const saved = await prisma.advanceTaxCalculation.create({
      data: {
        userId,
        financialYearCode: input.financialYearCode,
        inputs: JSON.parse(JSON.stringify(input)),
        result: JSON.parse(JSON.stringify(result)),
      },
    });

    await logAudit(userId, "CREATE", "AdvanceTaxCalculation", saved.id, { financialYearCode: input.financialYearCode });

    return { id: saved.id, ...result };
  },

  async list(userId: string, financialYearCode?: string) {
    const rows = await prisma.advanceTaxCalculation.findMany({
      where: { userId, ...(financialYearCode ? { financialYearCode } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({ id: r.id, financialYearCode: r.financialYearCode, createdAt: r.createdAt, inputs: r.inputs, result: r.result }));
  },
};
