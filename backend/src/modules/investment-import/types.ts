import ExcelJS from "exceljs";
import { InvestmentCategory } from "@prisma/client";

/** A single normalized transaction row extracted from a broker statement, before validation/dedupe. */
export interface ParsedInvestmentRow {
  rowNumber: number; // 1-based row index in the source worksheet, used for error reporting
  name: string;
  transactionType: string;
  purchaseDate: string; // ISO date string (yyyy-mm-dd) or "" if unparseable
  units: number | null;
  purchaseNav: number | null;
  amount: number | null;
  /** Exchange ticker symbol, when the statement provides one (e.g. Groww Stocks). Used for live price refresh. */
  symbol?: string | null;
  /** Current value at import time, when the statement itself provides it (e.g. a holdings snapshot). Falls back to `amount` if omitted. */
  currentValue?: number | null;
  /** Current NAV/price at import time, when the statement itself provides it (e.g. a holdings snapshot). */
  currentNav?: number | null;
}

export interface ImportRowResult extends ParsedInvestmentRow {
  isValid: boolean;
  issues: string[];
  isDuplicate: boolean;
}

/**
 * Common contract every broker/provider statement parser must implement.
 * Add a new provider by implementing this interface and registering it in
 * `importers/importer-registry.ts` — no other existing code needs to change.
 */
export interface InvestmentImporter {
  /** Stable machine key, e.g. "GROWW". Stored on Investment.broker / ImportHistory.provider. */
  readonly providerKey: string;
  /** Human-friendly name shown in the UI, e.g. "Groww Mutual Fund Order History". */
  readonly displayName: string;
  /** The Investment category rows from this provider should be created under. */
  readonly category: InvestmentCategory;
  /** Broker label stored on Investment.broker, e.g. "Groww". */
  readonly brokerName: string;
  /** Return true if this importer recognizes the shape of the given workbook. */
  canHandle(workbook: ExcelJS.Workbook): boolean;
  /** Parse every transaction row out of the workbook. Must not touch the database. */
  parse(workbook: ExcelJS.Workbook): ParsedInvestmentRow[];
}
