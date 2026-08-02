import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { InvestmentCategory, InvestmentStatus, Prisma, RiskLevel } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { createInvestmentSchema } from "./investments.dto";
import { serializeInvestment } from "./investments.service";

const CURRENCY_FORMAT = "#,##0.00";
const DATE_FORMAT = "dd-mmm-yyyy";

const EXPORT_COLUMNS = [
  { header: "Name", key: "name", width: 28 },
  { header: "Category", key: "category", width: 18 },
  { header: "Account", key: "account", width: 18 },
  { header: "Principal Amount", key: "principalAmount", width: 18, style: { numFmt: CURRENCY_FORMAT } },
  { header: "Current Value", key: "currentValue", width: 16, style: { numFmt: CURRENCY_FORMAT } },
  { header: "Profit", key: "profit", width: 14, style: { numFmt: CURRENCY_FORMAT } },
  { header: "ROI %", key: "roiPercent", width: 12, style: { numFmt: '0.00"%"' } },
  { header: "Target Value", key: "targetValue", width: 16, style: { numFmt: CURRENCY_FORMAT } },
  { header: "Purchase Date", key: "purchaseDate", width: 16, style: { numFmt: DATE_FORMAT } },
  { header: "Maturity Date", key: "maturityDate", width: 16, style: { numFmt: DATE_FORMAT } },
  { header: "SIP Amount", key: "sipAmount", width: 14, style: { numFmt: CURRENCY_FORMAT } },
  { header: "Risk Level", key: "riskLevel", width: 14 },
  { header: "Status", key: "status", width: 14 },
  { header: "Notes", key: "notes", width: 30 },
];

// 1-based column indexes matching EXPORT_COLUMNS order, used to attach dropdown validations.
const COLUMN_INDEX = {
  category: 2,
  purchaseDate: 9,
  maturityDate: 10,
  riskLevel: 12,
  status: 13,
};

/** Rows to keep dropdown/date validation active on beyond the existing data, so users can add new entries before re-importing. */
const EXTRA_BLANK_ROWS = 200;

function columnLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function applyListValidation(sheet: ExcelJS.Worksheet, columnIndex: number, lastRow: number, options: string[], errorTitle: string) {
  const col = columnLetter(columnIndex);
  const validation: ExcelJS.DataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [`"${options.join(",")}"`],
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle,
    error: `Please choose a value from the dropdown list: ${options.join(", ")}.`,
  };
  for (let row = 2; row <= lastRow; row += 1) {
    sheet.getCell(`${col}${row}`).dataValidation = validation;
  }
}

function applyDateValidation(sheet: ExcelJS.Worksheet, columnIndex: number, lastRow: number, errorTitle: string) {
  const col = columnLetter(columnIndex);
  const validation: ExcelJS.DataValidation = {
    type: "date",
    operator: "greaterThan",
    allowBlank: true,
    formulae: [new Date(1900, 0, 1)],
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle,
    error: "Please enter a valid date (e.g. 15-Jan-2026).",
  };
  for (let row = 2; row <= lastRow; row += 1) {
    sheet.getCell(`${col}${row}`).dataValidation = validation;
  }
}

export const investmentsImportExportService = {
  async exportToExcel(userId: string): Promise<Buffer> {
    const investments = await prisma.investment.findMany({ where: { userId }, orderBy: { purchaseDate: "desc" } });
    const rows = investments.map(serializeInvestment);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Investments");
    sheet.columns = EXPORT_COLUMNS;
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    rows.forEach((row) => {
      sheet.addRow({
        ...row,
        purchaseDate: new Date(row.purchaseDate as unknown as string),
        maturityDate: row.maturityDate ? new Date(row.maturityDate as unknown as string) : null,
      });
    });

    const lastRow = Math.max(rows.length, 1) + 1 + EXTRA_BLANK_ROWS;

    applyListValidation(sheet, COLUMN_INDEX.category, lastRow, Object.values(InvestmentCategory), "Invalid Category");
    applyListValidation(sheet, COLUMN_INDEX.riskLevel, lastRow, Object.values(RiskLevel), "Invalid Risk Level");
    applyListValidation(sheet, COLUMN_INDEX.status, lastRow, Object.values(InvestmentStatus), "Invalid Status");
    applyDateValidation(sheet, COLUMN_INDEX.purchaseDate, lastRow, "Invalid Purchase Date");
    applyDateValidation(sheet, COLUMN_INDEX.maturityDate, lastRow, "Invalid Maturity Date");

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },

  async exportToPdf(userId: string): Promise<Buffer> {
    const investments = await prisma.investment.findMany({ where: { userId }, orderBy: { purchaseDate: "desc" } });
    const rows = investments.map(serializeInvestment);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).text("Investments Report", { align: "center" });
      doc.moveDown();
      doc.fontSize(9);

      const headers = ["Name", "Category", "Principal", "Current", "Profit", "ROI %", "Status"];
      const colWidths = [160, 110, 90, 90, 90, 60, 80];
      let y = doc.y;
      headers.forEach((h, i) => {
        doc.text(h, 30 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i] } as never);
      });
      doc.moveDown();

      rows.forEach((inv) => {
        y = doc.y;
        const values = [
          inv.name,
          String(inv.category),
          Number(inv.principalAmount).toFixed(2),
          Number(inv.currentValue).toFixed(2),
          Number(inv.profit).toFixed(2),
          `${inv.roiPercent}%`,
          String(inv.status),
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

  async importFromExcel(userId: string, fileBuffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as never);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return { insertedCount: 0, errorCount: 0, errors: [] as { row: number; message: string }[] };
    }

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value ?? "").trim();
    });

    const errors: { row: number; message: string }[] = [];
    const toInsert: Prisma.InvestmentCreateManyInput[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header

      const record: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) record[header] = cell.value;
      });
      if (Object.keys(record).length === 0) return; // skip blank rows

      const candidate = {
        name: record["Name"] ?? record["name"],
        category: record["Category"] ?? record["category"],
        account: record["Account"] ?? record["account"],
        principalAmount: record["Principal Amount"] ?? record["principalAmount"],
        currentValue: record["Current Value"] ?? record["currentValue"],
        targetValue: record["Target Value"] ?? record["targetValue"] ?? undefined,
        purchaseDate: record["Purchase Date"] ?? record["purchaseDate"],
        maturityDate: record["Maturity Date"] ?? record["maturityDate"] ?? undefined,
        sipAmount: record["SIP Amount"] ?? record["sipAmount"] ?? undefined,
        riskLevel: record["Risk Level"] ?? record["riskLevel"] ?? "MODERATE",
        notes: record["Notes"] ?? record["notes"] ?? undefined,
        status: record["Status"] ?? record["status"] ?? "ACTIVE",
      };

      const parsed = createInvestmentSchema.safeParse(candidate);
      if (!parsed.success) {
        errors.push({ row: rowNumber, message: parsed.error.issues.map((i) => i.message).join("; ") });
        return;
      }
      toInsert.push({ ...parsed.data, userId });
    });

    if (toInsert.length > 0) {
      await prisma.investment.createMany({ data: toInsert });
    }

    return { insertedCount: toInsert.length, errorCount: errors.length, errors };
  },
};
