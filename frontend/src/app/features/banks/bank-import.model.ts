export interface BankImportColumns {
  headers: string[];
  sampleRows: string[][];
}

export interface BankImportMapping {
  date: string;
  description: string;
  amount?: string | null;
  debit?: string | null;
  credit?: string | null;
  bankAccountId?: string | null;
  toleranceDays?: number;
  toleranceAmount?: number;
}

export interface BankImportMatchedTransaction {
  id: string;
  type: string;
  amount: number;
  date: string;
  description: string | null;
  category: string | null;
}

export interface BankImportRow {
  rowNumber: number;
  date: string;
  description: string;
  amount: number;
  matched: boolean;
  matchedTransaction: BankImportMatchedTransaction | null;
}

export interface BankImportReconcileResult {
  fileName: string;
  rows: BankImportRow[];
  summary: { total: number; matched: number; unmatched: number };
}

export interface BankImportCommitEntry {
  rowNumber: number;
  date: string;
  description?: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  category?: string;
  paymentMode?: string;
  source?: string;
  bankAccountId?: string;
}

export interface BankImportCommitResult {
  results: { rowNumber: number; success: boolean; id?: string; error?: string }[];
  created: number;
  failed: number;
}
