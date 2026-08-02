export type TransactionType = 'INVESTMENT_BUY' | 'INVESTMENT_SELL' | 'SIP' | 'INCOME' | 'EXPENSE' | 'TRANSFER';

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
  amount: number;
  date: string;
  description?: string | null;
  category?: string | null;
  relatedInvestmentId?: string | null;
  bankAccountId?: string | null;
  createdAt: string;
  relatedInvestment?: { name: string } | null;
  bankAccount?: { bankName: string } | null;
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
}
