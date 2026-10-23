import ExcelJS from "exceljs";
import { InvestmentCategory } from "@prisma/client";
import { InvestmentImporter, ParsedInvestmentRow } from "../types";

/** Stable provider key used for generic user-mapped CSV/Excel imports. */
export const GENERIC_CSV_PROVIDER_KEY = "GENERIC_CSV";

/**
 * Placeholder registry entry for the generic column-mapping import flow.
 * `canHandle` always returns false — this importer is never chosen by `importerRegistry.detect()`;
 * it exists purely so `importerRegistry.getByKey(GENERIC_CSV_PROVIDER_KEY)` resolves to a
 * `brokerName` during commit. The actual category is supplied per-request by the user
 * (see `CommitImportInput.category`) since a generic file has no fixed category.
 */
export const genericCsvImporter: InvestmentImporter = {
  providerKey: GENERIC_CSV_PROVIDER_KEY,
  displayName: "Generic CSV / Excel (custom column mapping)",
  category: InvestmentCategory.OTHER,
  brokerName: "CSV Import",

  canHandle(): boolean {
    return false;
  },

  parse(): ParsedInvestmentRow[] {
    return [];
  },
};

/** The logical fields a user can map source file columns onto. */
export interface GenericCsvMapping {
  name: string;
  transactionType?: string | null;
  purchaseDate: string;
  units?: string | null;
  purchaseNav?: string | null;
  amount: string;
  symbol?: string | null;
}

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
  const text = cellText(value).replace(/,/g, "").replace(/[₹$\s]/g, "");
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Parses common date formats (ISO, DD-MM-YYYY, DD/MM/YYYY, "01 Jun 2026") plus Date instances/Excel serials; falls back to today when the cell is blank or unparseable. */
function parseDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = cellText(value);
  if (!text) return todayIso();

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const date = new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  const dmyMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const date = new Date(Date.UTC(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1])));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return todayIso();
}

/** Reads the header row (row 1) of a worksheet, returning normalized header -> column index. */
export function readHeaderRow(sheet: ExcelJS.Worksheet): { headers: string[]; columnMap: Record<string, number> } {
  const row = sheet.getRow(1);
  const headers: string[] = [];
  const columnMap: Record<string, number> = {};
  row.eachCell((cell, colNumber) => {
    const raw = cellText(cell.value);
    if (!raw) return;
    headers.push(raw);
    columnMap[normalizeHeader(raw)] = colNumber;
  });
  return { headers, columnMap };
}

/** Returns up to `limit` data rows (as raw cell text, in header order) for a mapping-preview UI. */
export function readSampleRows(sheet: ExcelJS.Worksheet, headers: string[], limit = 5): string[][] {
  const { columnMap } = readHeaderRow(sheet);
  const samples: string[][] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount && samples.length < limit; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = headers.map((h) => cellText(row.getCell(columnMap[normalizeHeader(h)]).value));
    if (values.every((v) => v === "")) continue;
    samples.push(values);
  }
  return samples;
}

function isRowBlank(row: ExcelJS.Row, columnIndexes: number[]): boolean {
  return columnIndexes.every((colIndex) => cellText(row.getCell(colIndex).value) === "");
}

/** Applies a user-supplied column mapping to every data row (row 2 onward) of the first worksheet. */
export function parseWithMapping(workbook: ExcelJS.Workbook, mapping: GenericCsvMapping): ParsedInvestmentRow[] {
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const { columnMap } = readHeaderRow(sheet);
  const resolve = (header?: string | null): number | undefined => {
    if (!header) return undefined;
    return columnMap[normalizeHeader(header)];
  };

  const nameCol = resolve(mapping.name);
  const dateCol = resolve(mapping.purchaseDate);
  const amountCol = resolve(mapping.amount);
  const typeCol = resolve(mapping.transactionType);
  const unitsCol = resolve(mapping.units);
  const navCol = resolve(mapping.purchaseNav);
  const symbolCol = resolve(mapping.symbol);

  if (nameCol === undefined || dateCol === undefined || amountCol === undefined) {
    return [];
  }

  const trackedColumns = [nameCol, dateCol, amountCol, typeCol, unitsCol, navCol, symbolCol].filter(
    (c): c is number => c !== undefined
  );

  const rows: ParsedInvestmentRow[] = [];
  let dataStarted = false;
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (isRowBlank(row, trackedColumns)) {
      if (dataStarted) break;
      continue;
    }
    dataStarted = true;

    rows.push({
      rowNumber,
      name: cellText(row.getCell(nameCol).value),
      transactionType: typeCol !== undefined ? cellText(row.getCell(typeCol).value).toUpperCase() : "BUY",
      purchaseDate: parseDate(row.getCell(dateCol).value),
      units: unitsCol !== undefined ? parseNumber(row.getCell(unitsCol).value) : null,
      purchaseNav: navCol !== undefined ? parseNumber(row.getCell(navCol).value) : null,
      amount: parseNumber(row.getCell(amountCol).value),
      symbol: symbolCol !== undefined ? cellText(row.getCell(symbolCol).value) || null : null,
    });
  }

  return rows;
}
