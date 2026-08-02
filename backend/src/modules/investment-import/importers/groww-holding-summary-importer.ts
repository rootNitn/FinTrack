import ExcelJS from "exceljs";
import { InvestmentCategory } from "@prisma/client";
import { InvestmentImporter, ParsedInvestmentRow } from "../types";

// This importer targets Groww's "Holding Summary" statement export — a point-in-time snapshot
// of currently-held mutual funds (Scheme Name / AMC / Category / Folio No. / Units / Invested
// Value / Current Value / Returns / XIRR), as opposed to the transaction-history "Order History"
// export (buy/sell rows with per-transaction NAV + date) already handled by `groww-importer.ts`.
// It's meant for users who only have this summary (e.g. old holdings bought outside the app and
// never tracked here) and want a quick way to bring them in as current ACTIVE holdings.
const REQUIRED_HEADERS = ["scheme name", "amc", "units", "invested value", "current value"];

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

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = cellText(value).replace(/,/g, "").replace(/[₹\s]/g, "");
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
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

/** Finds the "HOLDINGS AS ON yyyy-mm-dd" marker that precedes the table, used as the snapshot date. */
function findAsOfDate(sheet: ExcelJS.Worksheet, beforeRow: number): string {
  for (let rowNumber = 1; rowNumber < beforeRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    let text = "";
    row.eachCell((cell) => {
      const cellStr = cellText(cell.value);
      if (cellStr) text = text ? `${text} ${cellStr}` : cellStr;
    });
    const match = text.match(/holdings\s+as\s+on\s+(\d{4}-\d{2}-\d{2})/i);
    if (match) return match[1];
  }
  return new Date().toISOString().slice(0, 10);
}

function isRowBlank(row: ExcelJS.Row, columnMap: Record<string, number>): boolean {
  return Object.values(columnMap).every((colIndex) => cellText(row.getCell(colIndex).value) === "");
}

/**
 * Parses Groww "Holding Summary" statement exports. Each row is a current holding (one per
 * scheme/folio lot), not a transaction — so every row is imported as a single ACTIVE "BUY"
 * investment using the statement's own Invested/Current Value figures (average cost per unit
 * is derived since the file has no per-transaction NAV), with the "HOLDINGS AS ON" date used
 * as the purchase date since individual lot purchase dates aren't present in this format.
 */
export const growwHoldingSummaryImporter: InvestmentImporter = {
  providerKey: "GROWW_HOLDING_SUMMARY",
  displayName: "Groww Mutual Fund Holding Summary",
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
      const asOfDate = findAsOfDate(sheet, headerRowNumber);

      let dataStarted = false;
      for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        if (isRowBlank(row, columnMap)) {
          if (dataStarted) break;
          continue;
        }
        dataStarted = true;

        const units = parseNumber(row.getCell(columnMap["units"]).value);
        const investedValue = parseNumber(row.getCell(columnMap["invested value"]).value);
        const currentValue = parseNumber(row.getCell(columnMap["current value"]).value);

        rows.push({
          rowNumber,
          name: cellText(row.getCell(columnMap["scheme name"]).value),
          transactionType: "BUY",
          purchaseDate: asOfDate,
          units,
          purchaseNav: units && investedValue ? Number((investedValue / units).toFixed(4)) : null,
          amount: investedValue,
          currentValue,
          currentNav: units && currentValue ? Number((currentValue / units).toFixed(4)) : null,
        });
      }
      break; // only the first matching worksheet is treated as the holdings table
    }

    return rows;
  },
};
