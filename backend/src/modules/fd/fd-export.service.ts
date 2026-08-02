import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { ComparisonRow } from "./fd-rates.service";

export const fdExportService = {
  async exportComparisonToExcel(rows: ComparisonRow[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("FD Comparison");

    sheet.columns = [
      { header: "Rank", key: "rank", width: 8 },
      { header: "Bank Name", key: "bankName", width: 28 },
      { header: "Interest Rate %", key: "interestRate", width: 16 },
      { header: "Senior Citizen Rate %", key: "seniorCitizenRate", width: 20 },
      { header: "Min Deposit", key: "minDeposit", width: 14 },
      { header: "Max Deposit", key: "maxDeposit", width: 14 },
      { header: "Tenure", key: "tenureLabel", width: 20 },
      { header: "Compounding", key: "compounding", width: 14 },
      { header: "Maturity Amount", key: "maturityAmount", width: 18 },
      { header: "Extra Earned", key: "extraEarned", width: 16 },
      { header: "Rating", key: "rating", width: 10 },
      { header: "Deposit Insurance", key: "depositInsuranceCover", width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow(r));

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },

  async exportComparisonToPdf(rows: ComparisonRow[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).text("Fixed Deposit Comparison", { align: "center" });
      doc.moveDown();
      doc.fontSize(9);

      const headers = ["Rank", "Bank", "Rate %", "Tenure", "Maturity Amt", "Extra Earned", "Rating"];
      const colWidths = [40, 160, 60, 110, 110, 100, 60];
      let y = doc.y;
      headers.forEach((h, i) => {
        doc.text(h, 30 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i] } as never);
      });
      doc.moveDown();

      rows.forEach((row) => {
        y = doc.y;
        const values = [
          String(row.rank),
          row.bankName,
          `${row.interestRate}%`,
          row.tenureLabel,
          row.maturityAmount.toFixed(2),
          row.extraEarned.toFixed(2),
          row.rating.toFixed(1),
        ];
        values.forEach((v, i) => {
          doc.text(v, 30 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i] });
        });
        doc.moveDown(0.6);
        if (doc.y > 550) doc.addPage({ margin: 30, size: "A4", layout: "landscape" });
      });

      doc.end();
    });
  },
};
