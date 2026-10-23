export type TransactionType = 'INVESTMENT_BUY' | 'INVESTMENT_SELL' | 'SIP' | 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type TransactionSourceType = 'EXPENSE' | 'INCOME';

export const TRANSACTION_TYPES: TransactionType[] = [
  'INVESTMENT_BUY',
  'INVESTMENT_SELL',
  'SIP',
  'INCOME',
  'EXPENSE',
  'TRANSFER',
];

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  sourceType?: TransactionSourceType | null;
  sourceId?: string | null;
  amount: number;
  date: string;
  description?: string | null;
  category?: string | null;
  relatedInvestmentId?: string | null;
  bankAccountId?: string | null;
  familyMemberId?: string | null;
  createdAt: string;
  relatedInvestment?: { name: string } | null;
  bankAccount?: { bankName: string } | null;
  familyMember?: { name: string } | null;
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  totalInvestments: number;
  netCashFlow: number;
}

export interface TransactionListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  type?: TransactionType;
  from?: string;
  to?: string;
  bankAccountId?: string;
  category?: string;
  familyMemberId?: string;
}

export type TransactionSummaryParams = Omit<TransactionListParams, 'page' | 'limit' | 'sortBy' | 'sortDir' | 'type'>;

