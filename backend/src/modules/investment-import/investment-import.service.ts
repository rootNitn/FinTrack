import ExcelJS from "exceljs";
import { Readable } from "stream";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { importerRegistry } from "./importers/importer-registry";
import { GENERIC_CSV_PROVIDER_KEY, GenericCsvMapping, parseWithMapping, readHeaderRow, readSampleRows } from "./importers/generic-csv-importer";
import { buildDuplicateKey, evaluateRows, validateRow } from "./investment-import.utils";
import { CommitImportInput, ImportRowInput } from "./investment-import.dto";
import { ImportRowResult, ParsedInvestmentRow } from "./types";

/** Loads a workbook from an uploaded file buffer, supporting both .xlsx/.xls and plain .csv. */
async function loadWorkbookFromBuffer(fileBuffer: Buffer, fileName: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  if (fileName.toLowerCase().endsWith(".csv")) {
    await workbook.csv.read(Readable.from(fileBuffer));
  } else {
    await workbook.xlsx.load(fileBuffer as never);
  }
  return workbook;
}

export interface ParseSummary {
  totalRows: number;
  readyToImport: number;
  duplicates: number;
  invalid: number;
  totalAmount: number;
}

function buildSummary(rows: ImportRowResult[]): ParseSummary {
  const readyRows = rows.filter((r) => r.isValid && !r.isDuplicate);
  return {
    totalRows: rows.length,
    readyToImport: readyRows.length,
    duplicates: rows.filter((r) => r.isDuplicate).length,
    invalid: rows.filter((r) => !r.isValid).length,
    totalAmount: Number(readyRows.reduce((sum, r) => sum + (r.amount ?? 0), 0).toFixed(2)),
  };
}

async function loadExistingKeys(userId: string): Promise<Set<string>> {
  const existing = await prisma.investment.findMany({
    where: { userId },
    select: { name: true, purchaseDate: true, units: true, principalAmount: true },
  });
  return new Set(
    existing.map((inv) =>
      buildDuplicateKey(
        inv.name,
        inv.purchaseDate.toISOString().slice(0, 10),
        inv.units ? Number(inv.units) : null,
        Number(inv.principalAmount)
      )
    )
  );
}

export const investmentImportService = {
  /** Parses an uploaded broker statement and returns a validated, dedupe-checked preview — no database writes. */
  async parseFile(userId: string, fileName: string, fileBuffer: Buffer) {
    let workbook: ExcelJS.Workbook;
    try {
      workbook = await loadWorkbookFromBuffer(fileBuffer, fileName);
    } catch {
      throw AppError.badRequest("Could not read the uploaded file. Please upload a valid .xlsx, .xls or .csv file.");
    }

    const importer = importerRegistry.detect(workbook);
    if (!importer) {
      const supported = importerRegistry
        .all()
        .filter((i) => i.providerKey !== GENERIC_CSV_PROVIDER_KEY)
        .map((i) => i.displayName)
        .join(", ");
      throw AppError.badRequest(`Unrecognized statement format. Currently supported: ${supported}.`, {
        code: "UNRECOGNIZED_FORMAT",
      });
    }

    const parsedRows: ParsedInvestmentRow[] = importer.parse(workbook);
    if (parsedRows.length === 0) {
      throw AppError.badRequest("No transaction rows were found in the uploaded file.");
    }

    const existingKeys = await loadExistingKeys(userId);
    const rows = evaluateRows(parsedRows, existingKeys);
    const summary = buildSummary(rows);

    return {
      provider: importer.providerKey,
      providerName: importer.displayName,
      fileName,
      rows,
      summary,
    };
  },

  /**
   * Returns the column headers + a few sample rows for an uploaded file that didn't match any
   * known broker format — used to drive the generic CSV/Excel column-mapping UI.
   */
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

  /** Parses an uploaded file using a user-supplied column mapping (the generic CSV import flow). */
  async parseFileWithMapping(userId: string, fileName: string, fileBuffer: Buffer, mapping: GenericCsvMapping) {
    let workbook: ExcelJS.Workbook;
    try {
      workbook = await loadWorkbookFromBuffer(fileBuffer, fileName);
    } catch {
      throw AppError.badRequest("Could not read the uploaded file. Please upload a valid .xlsx, .xls or .csv file.");
    }

    const parsedRows = parseWithMapping(workbook, mapping);
    if (parsedRows.length === 0) {
      throw AppError.badRequest("No transaction rows were found using the selected column mapping.");
    }

    const existingKeys = await loadExistingKeys(userId);
    const rows = evaluateRows(parsedRows, existingKeys);
    const summary = buildSummary(rows);

    return {
      provider: GENERIC_CSV_PROVIDER_KEY,
      providerName: "Generic CSV / Excel (custom column mapping)",
      fileName,
      rows,
      summary,
    };
  },

  /** Persists the user-selected rows as Investments (+ linked transactions) and records an ImportHistory entry. */
  async commit(userId: string, importedBy: string, input: CommitImportInput) {
    const importer = importerRegistry.getByKey(input.provider);
    if (!importer) {
      throw AppError.badRequest(`Unknown import provider "${input.provider}".`);
    }
    if (importer.providerKey === GENERIC_CSV_PROVIDER_KEY && !input.category) {
      throw AppError.badRequest("A category must be selected for generic CSV imports.");
    }
    const category = input.provider === GENERIC_CSV_PROVIDER_KEY && input.category ? input.category : importer.category;

    if (input.goalId) {
      const goal = await prisma.goal.findFirst({ where: { id: input.goalId, userId } });
      if (!goal) throw AppError.badRequest("Selected goal not found.");
    }

    const existingKeys = await loadExistingKeys(userId);
    const seenInBatch = new Set<string>();

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let totalAmount = 0;
    const failedRows: (ImportRowInput & { reason: string })[] = [];

    for (const row of input.rows) {
      const issues = validateRow(row);
      if (issues.length > 0) {
        failed += 1;
        failedRows.push({ ...row, reason: issues.join("; ") });
        continue;
      }

      const key = buildDuplicateKey(row.name, row.purchaseDate, row.units, row.amount);
      if (existingKeys.has(key) || seenInBatch.has(key)) {
        skipped += 1;
        continue;
      }

      try {
        const amount = row.amount as number;
        const isSell = row.transactionType.toUpperCase().includes("SELL");
        await prisma.$transaction(async (tx) => {
          const created = await tx.investment.create({
            data: {
              userId,
              name: row.name.trim(),
              category,
              principalAmount: amount,
              // Statements that carry a live current value/NAV at export time (e.g. a holdings
              // snapshot) use it directly; other importers (transaction-history based) have no
              // such figure, so they fall back to the invested amount, same as before.
              currentValue: row.currentValue ?? amount,
              purchaseDate: new Date(row.purchaseDate),
              units: row.units ?? undefined,
              purchaseNav: row.purchaseNav ?? undefined,
              currentNav: row.currentNav ?? null,
              broker: importer.brokerName,
              source: "EXCEL_IMPORT",
              transactionType: row.transactionType || undefined,
              // SELL/redemption rows are not live holdings — marking them SOLD (instead of
              // ACTIVE) keeps them out of the live price refresh and current-value totals,
              // which previously kept re-valuing already-redeemed units at today's NAV.
              status: isSell ? "SOLD" : "ACTIVE",
              symbol: row.symbol || undefined,
              goalId: input.goalId || undefined,
            },
          });
          await tx.transaction.create({
            data: {
              userId,
              type: isSell ? "INVESTMENT_SELL" : "INVESTMENT_BUY",
              amount,
              date: new Date(row.purchaseDate),
              description: `Imported: ${row.name.trim()}`,
              category,
              relatedInvestmentId: created.id,
            },
          });

          // Only BUY/holding rows count as a live contribution towards the goal's saved amount —
          // a SELL/redemption row imported alongside old holdings shouldn't inflate it further.
          if (input.goalId && !isSell) {
            await tx.goal.update({ where: { id: input.goalId }, data: { currentAmount: { increment: amount } } });
          }
        });

        seenInBatch.add(key);
        imported += 1;
        totalAmount += amount;
      } catch (err) {
        failed += 1;
        failedRows.push({ ...row, reason: err instanceof Error ? err.message : "Failed to save this row" });
      }
    }

    await prisma.importHistory.create({
      data: {
        userId,
        fileName: input.fileName,
        provider: input.provider,
        totalRecords: input.rows.length,
        importedRecords: imported,
        skippedRecords: skipped,
        failedRecords: failed,
        totalAmount,
        importedBy,
      },
    });

    return {
      success: true,
      imported,
      skipped,
      failed,
      totalAmount: Number(totalAmount.toFixed(2)),
      failedRows,
    };
  },

  async history(userId: string) {
    return prisma.importHistory.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  },

  async exportFailedRows(rows: (ImportRowInput & { reason?: string })[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Failed Rows");
    sheet.columns = [
      { header: "Scheme Name", key: "name", width: 32 },
      { header: "Transaction Type", key: "transactionType", width: 18 },
      { header: "Units", key: "units", width: 12 },
      { header: "NAV", key: "purchaseNav", width: 12 },
      { header: "Amount", key: "amount", width: 14 },
      { header: "Date", key: "purchaseDate", width: 14 },
      { header: "Reason", key: "reason", width: 36 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },
};
