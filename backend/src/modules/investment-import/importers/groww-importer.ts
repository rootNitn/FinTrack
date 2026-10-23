import ExcelJS from "exceljs";
import { InvestmentCategory } from "@prisma/client";
import { InvestmentImporter, ParsedInvestmentRow } from "../types";

const REQUIRED_HEADERS = ["scheme name", "transaction type", "units", "nav", "amount", "date"];

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value !== null) {
    const obj = value as { text?: unknown; richText?: { text: string }[]; result?: unknown };
    if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text).join("").trim();
    if (obj.text !== undefined) return String(obj.text).trim();
    if (obj.result !== undefined) return String(obj.result).trim();
  }
  return String(value).trim();
}

/** Locates the header row (matching all REQUIRED_HEADERS, in any column order) within a worksheet. */
function findHeaderRow(sheet: ExcelJS.Worksheet): { rowNumber: number; columnMap: Record<string, number> } | null {
  const maxScanRows = Math.min(Math.max(sheet.rowCount, 1), 100);
  for (let rowNumber = 1; rowNumber <= maxScanRows; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const columnMap: Record<string, number> = {};
    row.eachCell((cell, colNumber) => {
      const header = normalizeHeader(cellText(cell.value));
      if (header) columnMap[header] = colNumber;
    });
    const hasAll = REQUIRED_HEADERS.every((h) => h in columnMap);
    if (hasAll) return { rowNumber, columnMap };
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = cellText(value).replace(/,/g, "").replace(/[₹\s]/g, "");
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Parses ExcelJS cell values (Date instances, Excel serials, or "01 Jun 2026" style strings) into ISO yyyy-mm-dd; falls back to today when the cell is blank or unparseable. */
function parseDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = cellText(value);
  if (!text) return todayIso();

  const match = text.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const monthKey = match[2].slice(0, 3).toLowerCase();
    const month = MONTHS[monthKey];
    const year = Number(match[3]);
    if (month !== undefined) {
      const date = new Date(Date.UTC(year, month, day));
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return todayIso();
}

function isRowBlank(row: ExcelJS.Row, columnMap: Record<string, number>): boolean {
  return Object.values(columnMap).every((colIndex) => cellText(row.getCell(colIndex).value) === "");
}

/**
 * Parses Groww "Mutual Fund Order History" statement exports.
 * Ignores the "Personal Details" header block (Name / Mobile Number / PAN) entirely —
 * the transaction table is located purely by its column headers, wherever they appear
 * in the sheet, so unrelated personal-info rows above/around it are automatically skipped.
 */
export const growwImporter: InvestmentImporter = {
  providerKey: "GROWW",
  displayName: "Groww Mutual Fund Order History",
  category: InvestmentCategory.MUTUAL_FUNDS,
  brokerName: "Groww",

  canHandle(workbook) {
    return workbook.worksheets.some((sheet) => findHeaderRow(sheet) !== null);
  },

  parse(workbook) {
    const rows: ParsedInvestmentRow[] = [];

    for (const sheet of workbook.worksheets) {
      const header = findHeaderRow(sheet);
      if (!header) continue;

      const { rowNumber: headerRowNumber, columnMap } = header;
      let dataStarted = false;
      for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        if (isRowBlank(row, columnMap)) {
          // Real-world exports sometimes have blank spacer rows between the header and the
          // first data row — only treat a blank row as "end of data" once data has begun.
          if (dataStarted) break;
          continue;
        }
        dataStarted = true;

        rows.push({
          rowNumber,
          name: cellText(row.getCell(columnMap["scheme name"]).value),
          transactionType: cellText(row.getCell(columnMap["transaction type"]).value).toUpperCase(),
          purchaseDate: parseDate(row.getCell(columnMap["date"]).value),
          units: parseNumber(row.getCell(columnMap["units"]).value),
          purchaseNav: parseNumber(row.getCell(columnMap["nav"]).value),
          amount: parseNumber(row.getCell(columnMap["amount"]).value),
        });
      }
      break; // only the first matching worksheet is treated as the transaction table
    }

    return rows;
  },
};
