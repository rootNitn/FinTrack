import ExcelJS from "exceljs";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import {
  cellText,
  isRowBlank,
  loadWorkbookFromBuffer,
  parseDateToIso,
  parseNumber,
  readHeaderRow,
  readSampleRows,
  resolveColumn,
} from "../../utils/spreadsheet-parsing.util";
import { BankImportCommitEntry, BankImportMapping } from "./bank-import.dto";
import { expensesService } from "../expenses/expenses.service";
import { incomeService } from "../income/income.service";

interface ParsedBankRow {
  rowNumber: number;
  date: string;
  description: string;
  amount: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseRows(workbook: ExcelJS.Workbook, mapping: BankImportMapping): ParsedBankRow[] {
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const { columnMap } = readHeaderRow(sheet);
  const dateCol = resolveColumn(columnMap, mapping.date);
  const descCol = resolveColumn(columnMap, mapping.description);
  const amountCol = resolveColumn(columnMap, mapping.amount);
  const debitCol = resolveColumn(columnMap, mapping.debit);
  const creditCol = resolveColumn(columnMap, mapping.credit);

  if (dateCol === undefined || descCol === undefined || (amountCol === undefined && debitCol === undefined && creditCol === undefined)) {
    return [];
  }

  const trackedColumns = [dateCol, descCol, amountCol, debitCol, creditCol].filter((c): c is number => c !== undefined);

  const rows: ParsedBankRow[] = [];
  let dataStarted = false;
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (isRowBlank(row, trackedColumns)) {
      if (dataStarted) break;
      continue;
    }
    dataStarted = true;

    let amount: number | null = null;
    if (amountCol !== undefined) {
      amount = parseNumber(row.getCell(amountCol).value);
    } else {
      const debit = debitCol !== undefined ? parseNumber(row.getCell(debitCol).value) ?? 0 : 0;
      const credit = creditCol !== undefined ? parseNumber(row.getCell(creditCol).value) ?? 0 : 0;
      amount = credit - debit;
    }
    if (amount === null || amount === 0) continue;

    rows.push({
      rowNumber,
      date: parseDateToIso(row.getCell(dateCol).value),
      description: cellText(row.getCell(descCol).value),
      amount,
    });
  }

  return rows;
}

export const bankImportService = {
  /** Returns the column headers + a few sample rows for an uploaded bank statement — drives the column-mapping UI. */
  async getColumns(fileName: string, fileBuffer: Buffer) {
    let workbook: ExcelJS.Workbook;
    try {
      workbook = await loadWorkbookFromBuffer(fileBuffer, fileName);
    } catch {
      throw AppError.badRequest("Could not read the uploaded file. Please upload a valid .xlsx, .xls or .csv file.");
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw AppError.badRequest("The uploaded file has no worksheet/rows.");

    const { headers } = readHeaderRow(sheet);
    if (headers.length === 0) throw AppError.badRequest("Could not find a header row in the uploaded file.");

    return { headers, sampleRows: readSampleRows(sheet, headers) };
  },

  /**
   * Reconciles an uploaded bank statement against the user's own recorded Transaction ledger —
   * a read-only comparison report, nothing is created/modified. Each statement row is greedily
   * matched to the closest-by-date unmatched Transaction whose amount is within `toleranceAmount`
   * (defaults ₹1, to absorb rounding) — a transaction can only be consumed by one statement row.
   */
  async reconcile(userId: string, fileName: string, fileBuffer: Buffer, mapping: BankImportMapping) {
    let workbook: ExcelJS.Workbook;
    try {
      workbook = await loadWorkbookFromBuffer(fileBuffer, fileName);
    } catch {
      throw AppError.badRequest("Could not read the uploaded file. Please upload a valid .xlsx, .xls or .csv file.");
    }

    const parsedRows = parseRows(workbook, mapping);
    if (parsedRows.length === 0) {
      throw AppError.badRequest("No statement rows were found using this column mapping.");
    }

    const dates = parsedRows.map((r) => new Date(r.date).getTime());
    const minDate = new Date(Math.min(...dates) - mapping.toleranceDays * MS_PER_DAY);
    const maxDate = new Date(Math.max(...dates) + mapping.toleranceDays * MS_PER_DAY);

    const candidates = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: minDate, lte: maxDate },
        ...(mapping.bankAccountId ? { bankAccountId: mapping.bankAccountId } : {}),
      },
      orderBy: { date: "asc" },
    });

    const usedTransactionIds = new Set<string>();
    const rows = parsedRows
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((row) => {
        const rowDate = new Date(row.date).getTime();
        const absAmount = Math.abs(row.amount);

        let best: (typeof candidates)[number] | null = null;
        let bestDayDiff = Infinity;
        for (const txn of candidates) {
          if (usedTransactionIds.has(txn.id)) continue;
          const amountDiff = Math.abs(Number(txn.amount) - absAmount);
          if (amountDiff > mapping.toleranceAmount) continue;
          const dayDiff = Math.abs(txn.date.getTime() - rowDate) / MS_PER_DAY;
          if (dayDiff > mapping.toleranceDays) continue;
          if (dayDiff < bestDayDiff) {
            best = txn;
            bestDayDiff = dayDiff;
          }
        }

        if (best) usedTransactionIds.add(best.id);

        return {
          rowNumber: row.rowNumber,
          date: row.date,
          description: row.description,
          amount: row.amount,
          matched: !!best,
          matchedTransaction: best
            ? {
                id: best.id,
                type: best.type,
                amount: Number(best.amount),
                date: best.date,
                description: best.description,
                category: best.category,
              }
            : null,
        };
      });

    const matched = rows.filter((r) => r.matched).length;
    return {
      fileName,
      rows,
      summary: { total: rows.length, matched, unmatched: rows.length - matched },
    };
  },

  /**
   * Converts selected unmatched statement rows into real Expense/Income entries in one click —
   * the only write path this module has. Each entry is created independently (via the same
   * services/validation used by the manual Add Expense/Income forms, so bank balance adjustment
   * and duplicate detection stay consistent) so one bad row doesn't fail the whole batch.
   */
  async commit(userId: string, entries: BankImportCommitEntry[]) {
    const results: { rowNumber: number; success: boolean; id?: string; error?: string }[] = [];

    for (const entry of entries) {
      try {
        if (entry.type === "EXPENSE") {
          const created = (await expensesService.create(userId, {
            date: entry.date,
            category: entry.category!,
            amount: entry.amount,
            paymentMode: entry.paymentMode ?? "BANK_TRANSFER",
            description: entry.description,
            bankAccountId: entry.bankAccountId,
            familyMemberId: entry.familyMemberId ?? null,
            isRecurring: false,
            force: true,
          })) as { id: string };
          results.push({ rowNumber: entry.rowNumber, success: true, id: created.id });
        } else {
          const created = await incomeService.create(userId, {
            date: entry.date,
            source: entry.source!,
            amount: entry.amount,
            description: entry.description,
            bankAccountId: entry.bankAccountId,
            familyMemberId: entry.familyMemberId ?? null,
            isRecurring: false,
            force: true,
          });
          results.push({ rowNumber: entry.rowNumber, success: true, id: created.id });
        }
      } catch (err) {
        results.push({
          rowNumber: entry.rowNumber,
          success: false,
          error: err instanceof AppError ? err.message : "Failed to create entry",
        });
      }
    }

    return {
      results,
      created: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };
  },
};
