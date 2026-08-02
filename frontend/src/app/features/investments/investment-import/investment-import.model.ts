export interface ImportPreviewRow {
  rowNumber: number;
  name: string;
  transactionType: string;
  purchaseDate: string;
  units: number | null;
  purchaseNav: number | null;
  amount: number | null;
  isValid: boolean;
  issues: string[];
  isDuplicate: boolean;
  symbol?: string | null;
  currentValue?: number | null;
  currentNav?: number | null;
}

export interface ImportParseSummary {
  totalRows: number;
  readyToImport: number;
  duplicates: number;
  invalid: number;
  totalAmount: number;
}

export interface ImportParseResponse {
  provider: string;
  providerName: string;
  fileName: string;
  rows: ImportPreviewRow[];
  summary: ImportParseSummary;
}

export interface ImportFailedRow extends ImportPreviewRow {
  reason: string;
}

export interface ImportCommitResponse {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  totalAmount: number;
  failedRows: ImportFailedRow[];
}

export interface ImportHistoryRecord {
  id: string;
  fileName: string;
  provider: string;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  failedRecords: number;
  totalAmount: number;
  importedBy: string;
  createdAt: string;
}

/** Drives the step indicator/progress bar in the import dialog. */
export type ImportStage = 'idle' | 'uploading' | 'reading' | 'validating' | 'importing' | 'completed';

export const GENERIC_CSV_PROVIDER_KEY = 'GENERIC_CSV';

/** Column headers + a few sample rows returned for a file that didn't match a known broker format. */
export interface ImportColumnsResponse {
  headers: string[];
  sampleRows: string[][];
}

/** Maps logical investment fields onto source-file column headers, for the generic CSV import flow. */
export interface GenericCsvMapping {
  name: string;
  transactionType?: string | null;
  purchaseDate: string;
  units?: string | null;
  purchaseNav?: string | null;
  amount: string;
  symbol?: string | null;
}
