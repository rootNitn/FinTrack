import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { TaxCalculationInput, TaxComparisonResult } from "./calculators/tax-calculator.types";
import { StructuredTaxSavingSuggestion } from "../tax-planner/tax-planner-suggestions.util";

export type TaxReportType =
  | "INCOME_SUMMARY"
  | "TAX_SUMMARY"
  | "CAPITAL_GAINS"
  | "TDS_SUMMARY"
  | "TAX_SAVING"
  | "INVESTMENT_SUMMARY";

export interface TaxReportTable {
  title: string;
  financialYearCode: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

function toNum(v: { toNumber: () => number } | null | undefined): number {
  return v ? v.toNumber() : 0;
}

async function requireLatestCalculation(userId: string, financialYearCode: string) {
  const latest = await prisma.taxCalculation.findFirst({
    where: { userId, financialYearCode },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) {
    throw AppError.notFound("No saved tax calculation found for this financial year. Save a calculation first.");
  }
  return {
    inputs: latest.inputs as unknown as TaxCalculationInput,
    result: latest.result as unknown as TaxComparisonResult,
  };
}

export const taxReportsService = {
  async generate(userId: string, financialYearCode: string, reportType: TaxReportType): Promise<TaxReportTable> {
    switch (reportType) {
      case "INCOME_SUMMARY":
        return taxReportsService.incomeSummary(userId, financialYearCode);
      case "TAX_SUMMARY":
        return taxReportsService.taxSummary(userId, financialYearCode);
      case "CAPITAL_GAINS":
        return taxReportsService.capitalGainsReport(userId, financialYearCode);
      case "TDS_SUMMARY":
        return taxReportsService.tdsSummary(userId, financialYearCode);
      case "TAX_SAVING":
        return taxReportsService.taxSavingReport(userId, financialYearCode);
      case "INVESTMENT_SUMMARY":
        return taxReportsService.investmentSummary(userId, financialYearCode);
      default:
        throw AppError.badRequest("Unknown report type");
    }
  },

  async incomeSummary(userId: string, financialYearCode: string): Promise<TaxReportTable> {
    const { inputs, result } = await requireLatestCalculation(userId, financialYearCode);
    const recommended = result[result.recommendedRegime === "OLD" ? "old" : "new"];
    const rows: Array<[string, number]> = [
      ["Basic Salary", inputs.salary.basicSalary],
      ["HRA Received", inputs.salary.hraReceived],
      ["Special Allowance", inputs.salary.specialAllowance],
      ["Bonus", inputs.salary.bonus],
      ["Perquisites", inputs.salary.perquisites],
      ["House Property Income", inputs.houseProperty.rentalIncome - inputs.houseProperty.municipalTaxes - inputs.houseProperty.homeLoanInterest],
      ["Other Sources Income", recommended.incomeBreakdown.otherSourcesIncome],
      ["Business/Professional Income", recommended.incomeBreakdown.businessIncome],
      ["Capital Gains (slab-taxed portion)", recommended.incomeBreakdown.capitalGainsSlabTaxed],
      ["Gross Total Income", recommended.incomeBreakdown.grossTotalIncome],
    ];
    return { title: "Income Summary", financialYearCode, columns: ["Component", "Amount (₹)"], rows };
  },

  async taxSummary(userId: string, financialYearCode: string): Promise<TaxReportTable> {
    const { result } = await requireLatestCalculation(userId, financialYearCode);
    const rows: Array<[string, number, number]> = [
      ["Taxable Income", result.old.taxableIncome, result.new.taxableIncome],
      ["Tax on Slab Income", result.old.taxOnSlabIncome, result.new.taxOnSlabIncome],
      ["Special Rate Tax (Capital Gains)", result.old.capitalGainsTax.totalSpecialRateTax, result.new.capitalGainsTax.totalSpecialRateTax],
      ["Rebate (Sec 87A)", result.old.rebateAmount, result.new.rebateAmount],
      ["Surcharge", result.old.surchargeAmount, result.new.surchargeAmount],
      ["Health & Education Cess", result.old.cessAmount, result.new.cessAmount],
      ["Total Tax Payable", result.old.totalTaxPayable, result.new.totalTaxPayable],
    ];
    return {
      title: `Tax Summary (Recommended: ${result.recommendedRegime === "OLD" ? "Old" : "New"} Regime)`,
      financialYearCode,
      columns: ["Component", "Old Regime (₹)", "New Regime (₹)"],
      rows,
    };
  },

  async capitalGainsReport(userId: string, financialYearCode: string): Promise<TaxReportTable> {
    const transactions = await prisma.capitalGainsTransaction.findMany({
      where: { userId, financialYearCode },
      orderBy: { saleDate: "asc" },
    });
    const rows = transactions.map((t) => [
      t.assetType,
      t.termType,
      t.holdingPeriodDays,
      toNum(t.gainAmount),
      toNum(t.taxAmount),
    ]);
    return {
      title: "Capital Gains Report",
      financialYearCode,
      columns: ["Asset Type", "Term", "Holding (days)", "Gain (₹)", "Tax (₹)"],
      rows,
    };
  },

  async tdsSummary(userId: string, financialYearCode: string): Promise<TaxReportTable> {
    const [form26as, form16s] = await Promise.all([
      prisma.form26ASRecord.findFirst({ where: { userId, financialYearCode }, orderBy: { createdAt: "desc" } }),
      prisma.form16Record.findMany({ where: { userId, financialYearCode } }),
    ]);
    const rows: Array<[string, number]> = [
      ["Employer TDS (Form 26AS)", toNum(form26as?.employerTds)],
      ["Bank TDS", toNum(form26as?.bankTds)],
      ["Dividend TDS", toNum(form26as?.dividendTds)],
      ["Property TDS", toNum(form26as?.propertyTds)],
      ["Professional Income TDS", toNum(form26as?.professionalIncomeTds)],
      ["Advance Tax Paid", toNum(form26as?.advanceTax)],
      ["Self-Assessment Tax", toNum(form26as?.selfAssessmentTax)],
      ["Total Tax Paid (Form 26AS)", toNum(form26as?.totalTaxPaid)],
      ["Refund (if any)", toNum(form26as?.refund)],
      ["Total TDS across Form 16(s)", form16s.reduce((sum, f) => sum + toNum(f.tdsDeducted), 0)],
    ];
    return { title: "TDS Summary", financialYearCode, columns: ["Component", "Amount (₹)"], rows };
  },

  async taxSavingReport(userId: string, financialYearCode: string): Promise<TaxReportTable> {
    const latest = await prisma.taxSavingPlan.findFirst({ where: { userId, financialYearCode }, orderBy: { createdAt: "desc" } });
    if (!latest) throw AppError.notFound("No saved Tax Saving Plan found for this financial year. Generate one first.");
    const suggestions = latest.suggestions as unknown as StructuredTaxSavingSuggestion[];
    const rows = suggestions.map((s) => [s.title, s.investmentRequired, s.potentialTaxSaving, s.priorityScore]);
    return {
      title: "Tax Saving Report",
      financialYearCode,
      columns: ["Suggestion", "Investment Required (₹)", "Potential Tax Saving (₹)", "Priority"],
      rows,
    };
  },

  async investmentSummary(userId: string, financialYearCode: string): Promise<TaxReportTable> {
    const { inputs } = await requireLatestCalculation(userId, financialYearCode);
    const d = inputs.deductions;
    const rows: Array<[string, number]> = [
      ["Section 80C", d.section80C],
      ["Section 80CCD(1B) - NPS", d.section80CCD1B],
      ["Employer NPS Contribution - Sec 80CCD(2)", d.employerNpsContribution],
      ["Section 80D - Self/Family Health Insurance", d.section80DSelf],
      ["Section 80D - Parents Health Insurance", d.section80DParents],
      ["Section 80E - Education Loan Interest", d.section80E],
      ["Section 80G - Donations", d.section80G],
      ["Other Deductions", d.otherDeductions],
    ];
    return { title: "Deduction-Eligible Investment Summary", financialYearCode, columns: ["Section", "Amount (₹)"], rows };
  },

  async exportToExcel(table: TaxReportTable): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(table.title.slice(0, 31));
    sheet.columns = table.columns.map((c, i) => ({ header: c, key: `c${i}`, width: i === 0 ? 40 : 22 }));
    sheet.getRow(1).font = { bold: true };
    table.rows.forEach((row) => {
      const record: Record<string, string | number> = {};
      row.forEach((value, i) => (record[`c${i}`] = value));
      sheet.addRow(record);
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },

  async exportToPdf(table: TaxReportTable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(16).text(`${table.title} - FY ${table.financialYearCode}`, { align: "center" });
      doc.moveDown();

      const colWidth = Math.floor(500 / table.columns.length);
      doc.fontSize(9);
      let y = doc.y;
      table.columns.forEach((h, i) => doc.text(h, 40 + i * colWidth, y, { width: colWidth }));
      doc.moveDown(0.5);

      table.rows.forEach((row) => {
        y = doc.y;
        row.forEach((v, i) => {
          const text = typeof v === "number" ? v.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : String(v);
          doc.text(text, 40 + i * colWidth, y, { width: colWidth });
        });
        doc.moveDown(0.5);
      });

      doc.end();
    });
  },
};
