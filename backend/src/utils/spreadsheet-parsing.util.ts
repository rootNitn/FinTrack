import ExcelJS from "exceljs";
import { Readable } from "stream";

/** Loads a workbook from an uploaded file buffer, supporting both .xlsx/.xls and plain .csv. */
export async function loadWorkbookFromBuffer(fileBuffer: Buffer, fileName: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  if (fileName.toLowerCase().endsWith(".csv")) {
    await workbook.csv.read(Readable.from(fileBuffer));
  } else {
    await workbook.xlsx.load(fileBuffer as never);
  }
  return workbook;
}

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value !== null) {
    const obj = value as { text?: unknown; richText?: { text: string }[]; result?: unknown };
    if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text).join("").trim();
    if (obj.text !== undefined) return String(obj.text).trim();
    if (obj.result !== undefined) return String(obj.result).trim();
  }
  return String(value).trim();
}

export function parseNumber(value: unknown): number | null {
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
export function parseDateToIso(value: unknown): string {
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

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
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

/** Resolves a user-picked header name back to its column index for the given sheet. */
export function resolveColumn(columnMap: Record<string, number>, header?: string | null): number | undefined {
  if (!header) return undefined;
  return columnMap[normalizeHeader(header)];
}

export function isRowBlank(row: ExcelJS.Row, columnIndexes: number[]): boolean {
  return columnIndexes.every((colIndex) => cellText(row.getCell(colIndex).value) === "");
}
