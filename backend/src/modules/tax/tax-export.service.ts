import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { RegimeResult, TaxComparisonResult } from "./calculators/tax-calculator.types";

function regimeRows(result: RegimeResult) {
  return [
    ["Gross Total Income", result.incomeBreakdown.grossTotalIncome],
    ["Total Deductions", result.totalDeductions],
    ["Taxable Income", result.taxableIncome],
    ["Tax on Slab Income", result.taxOnSlabIncome],
    ["Special Rate Tax (Capital Gains)", result.capitalGainsTax.totalSpecialRateTax],
    ["Rebate (Sec 87A)", -result.rebateAmount],
    ["Surcharge", result.surchargeAmount],
    ["Health & Education Cess", result.cessAmount],
    ["Total Tax Payable", result.totalTaxPayable],
  ] as const;
}

export const taxExportService = {
  async exportToExcel(comparison: TaxComparisonResult): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Tax Summary ${comparison.financialYearCode}`);

    sheet.columns = [
      { header: "Component", key: "component", width: 34 },
      { header: "Old Regime (₹)", key: "old", width: 20 },
      { header: "New Regime (₹)", key: "newRegime", width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };

    const oldRows = regimeRows(comparison.old);
    const newRows = regimeRows(comparison.new);
    oldRows.forEach(([label, oldVal], i) => {
      sheet.addRow({ component: label, old: oldVal, newRegime: newRows[i][1] });
    });

    sheet.addRow({});
    sheet.addRow({ component: "Recommended Regime", old: comparison.recommendedRegime });
    sheet.addRow({ component: "Tax Saved", old: comparison.taxSaved });

    const suggestionsSheet = workbook.addWorksheet("Tax Saving Suggestions");
    suggestionsSheet.columns = [{ header: "Suggestion", key: "text", width: 100 }];
    suggestionsSheet.getRow(1).font = { bold: true };
    comparison.suggestions.forEach((s) => suggestionsSheet.addRow({ text: s }));

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },

  async exportToPdf(comparison: TaxComparisonResult): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).text(`Income Tax Calculation Summary - FY ${comparison.financialYearCode}`, { align: "center" });
      doc.moveDown();

      doc.fontSize(9);
      const headers = ["Component", "Old Regime (Rs.)", "New Regime (Rs.)"];
      const colWidths = [260, 130, 130];
      let y = doc.y;
      headers.forEach((h, i) => {
        doc.text(h, 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i] } as never);
      });
      doc.moveDown(0.5);

      const oldRows = regimeRows(comparison.old);
      const newRows = regimeRows(comparison.new);
      oldRows.forEach(([label, oldVal], i) => {
        y = doc.y;
        const values = [label, oldVal.toFixed(2), newRows[i][1].toFixed(2)];
        values.forEach((v, colIdx) => {
          doc.text(v, 40 + colWidths.slice(0, colIdx).reduce((a, b) => a + b, 0), y, { width: colWidths[colIdx] });
        });
        doc.moveDown(0.5);
      });

      doc.moveDown();
      doc.fontSize(12).text(`Recommended Regime: ${comparison.recommendedRegime}`, { continued: false });
      doc.text(`Tax Saved: Rs. ${comparison.taxSaved.toFixed(2)}`);
      doc.moveDown();

      doc.fontSize(13).text("Tax Saving Suggestions", { underline: true });
      doc.fontSize(10);
      comparison.suggestions.forEach((s) => {
        doc.moveDown(0.3);
        doc.text(`• ${s}`, { width: 500 });
      });

      doc.end();
    });
  },
};
