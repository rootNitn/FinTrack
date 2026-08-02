import ExcelJS from "exceljs";
import { InvestmentCategory } from "@prisma/client";
import { InvestmentImporter, ParsedInvestmentRow } from "../types";

/**
 * Column headers as published by Upstox's web/app "Trade Book" report export
 * (Reports > Trades > Download). Assumptions are based on Upstox's publicly documented
 * trade-book column conventions since no real sample file was available at
 * implementation time — if a real export uses different header text, adjust
 * REQUIRED_HEADERS / the column lookups below accordingly.
 */
const REQUIRED_HEADERS = ["symbol", "trade date", "transaction type", "quantity", "price"];

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

/** Parses "YYYY-MM-DD", "DD-MM-YYYY", or Date instances/Excel serials into ISO yyyy-mm-dd. */
function parseDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = cellText(value);
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const date = new Date(Date.UTC(year, month, day));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  const dmyMatch = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]) - 1;
    const year = Number(dmyMatch[3]);
    const date = new Date(Date.UTC(year, month, day));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function isRowBlank(row: ExcelJS.Row, columnMap: Record<string, number>): boolean {
  return Object.values(columnMap).every((colIndex) => cellText(row.getCell(colIndex).value) === "");
}

/**
 * Parses Upstox "Trade Book" statement exports.
 * Each row is one executed trade (buy or sell); Upstox's trade book does not include a
 * separate "company name" column, so the exchange symbol is used as both `name` and
 * `symbol` — `symbol` also drives live price refresh for STOCKS investments.
 */
export const upstoxImporter: InvestmentImporter = {
  providerKey: "UPSTOX",
  displayName: "Upstox Trade Book",
  category: InvestmentCategory.STOCKS,
  brokerName: "Upstox",

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
          if (dataStarted) break;
          continue;
        }
        dataStarted = true;

        const units = parseNumber(row.getCell(columnMap["quantity"]).value);
        const purchaseNav = parseNumber(row.getCell(columnMap["price"]).value);
        const amount = units !== null && purchaseNav !== null ? Number((units * purchaseNav).toFixed(2)) : null;
        const symbol = cellText(row.getCell(columnMap["symbol"]).value) || null;

        rows.push({
          rowNumber,
          name: symbol ?? "",
          transactionType: cellText(row.getCell(columnMap["transaction type"]).value).toUpperCase(),
          purchaseDate: parseDate(row.getCell(columnMap["trade date"]).value),
          units,
          purchaseNav,
          amount,
          symbol,
        });
      }
      break; // only the first matching worksheet is treated as the transaction table
    }

    return rows;
  },
};
