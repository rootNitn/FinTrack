import ExcelJS from "exceljs";
import { InvestmentCategory } from "@prisma/client";
import { InvestmentImporter, ParsedInvestmentRow } from "../types";

// This importer targets Groww's "Holdings Statement for Stocks" export — a point-in-time
// snapshot of currently-held stocks (Stock Name / ISIN / Quantity / Average Buy Price / Buy
// Value / Closing Price / Closing Value / Unrealised P&L), as opposed to the transaction-history
// "Stocks Order History" export already handled by `groww-stocks-importer.ts`. It's meant for
// users who only have this summary (e.g. old holdings never tracked here) and want a quick way
// to bring them in as current ACTIVE holdings.
const REQUIRED_HEADERS = ["stock name", "isin", "quantity", "average buy price", "buy value", "closing price", "closing value"];

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

/** Finds the "Holdings statement for stocks as on dd-mm-yyyy" marker that precedes the table. */
function findAsOfDate(sheet: ExcelJS.Worksheet, beforeRow: number): string {
  for (let rowNumber = 1; rowNumber < beforeRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    let text = "";
    row.eachCell((cell) => {
      const cellStr = cellText(cell.value);
      if (cellStr) text = text ? `${text} ${cellStr}` : cellStr;
    });
    const match = text.match(/holdings\s+statement\s+for\s+stocks\s+as\s+on\s+(\d{1,2})-(\d{1,2})-(\d{4})/i);
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]) - 1;
      const year = Number(match[3]);
      const date = new Date(Date.UTC(year, month, day));
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

function isRowBlank(row: ExcelJS.Row, columnMap: Record<string, number>): boolean {
  return Object.values(columnMap).every((colIndex) => cellText(row.getCell(colIndex).value) === "");
}

/**
 * Parses Groww "Holdings Statement for Stocks" exports. Each row is a current holding, not a
 * transaction — so every row is imported as a single ACTIVE "BUY" investment using the
 * statement's own Buy/Closing Value + Average Buy/Closing Price figures directly, with the
 * "as on" date used as the purchase date since individual lot purchase dates aren't present
 * in this format. Note: this statement has no exchange ticker symbol (only ISIN), so these
 * rows won't have a `symbol` set — future "Refresh Prices" runs will skip them (same as any
 * other symbol-less stock), same as the values already imported here stay accurate as of the
 * statement's snapshot date.
 */
export const growwStocksHoldingSummaryImporter: InvestmentImporter = {
  providerKey: "GROWW_STOCKS_HOLDING_SUMMARY",
  displayName: "Groww Stocks Holding Summary",
  category: InvestmentCategory.STOCKS,
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

        rows.push({
          rowNumber,
          name: cellText(row.getCell(columnMap["stock name"]).value),
          transactionType: "BUY",
          purchaseDate: asOfDate,
          units: parseNumber(row.getCell(columnMap["quantity"]).value),
          purchaseNav: parseNumber(row.getCell(columnMap["average buy price"]).value),
          amount: parseNumber(row.getCell(columnMap["buy value"]).value),
          currentValue: parseNumber(row.getCell(columnMap["closing value"]).value),
          currentNav: parseNumber(row.getCell(columnMap["closing price"]).value),
        });
      }
      break; // only the first matching worksheet is treated as the holdings table
    }

    return rows;
  },
};
