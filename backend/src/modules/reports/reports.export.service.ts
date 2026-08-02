import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { stringify } from "csv-stringify/sync";

type ReportData = Record<string, unknown> & { type: string; rows?: Record<string, unknown>[] };

function flattenForExport(report: ReportData): Record<string, unknown>[] {
  if (Array.isArray(report.rows) && report.rows.length > 0) {
    return report.rows;
  }
  // Aggregate-style report (monthly/quarterly/yearly) — single summary row.
  const { rows: _rows, ...summary } = report;
  return [summary];
}

export const reportsExportService = {
  async toExcel(report: ReportData): Promise<Buffer> {
    const rows = flattenForExport(report);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`${report.type} report`.slice(0, 31));

    if (rows.length > 0) {
      sheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key, width: 20 }));
      sheet.getRow(1).font = { bold: true };
      rows.forEach((row) => sheet.addRow(row));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },

  toCsv(report: ReportData): string {
    const rows = flattenForExport(report);
    if (rows.length === 0) return "";
    return stringify(rows, { header: true, columns: Object.keys(rows[0]) });
  },

  async toPdf(report: ReportData): Promise<Buffer> {
    const rows = flattenForExport(report);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).text(`${String(report.type).toUpperCase()} REPORT`, { align: "center" });
      doc.moveDown();
      doc.fontSize(9);

      rows.forEach((row, index) => {
        Object.entries(row).forEach(([key, value]) => {
          doc.text(`${key}: ${value instanceof Date ? value.toISOString() : String(value)}`);
        });
        if (index < rows.length - 1) {
          doc.moveDown(0.5);
          doc.text("—".repeat(40));
          doc.moveDown(0.5);
        }
        if (doc.y > 720) doc.addPage();
      });

      doc.end();
    });
  },
};
