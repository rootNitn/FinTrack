export type ExpenseCategory =
  | 'FOOD'
  | 'RENT'
  | 'FUEL'
  | 'SHOPPING'
  | 'TRAVEL'
  | 'ENTERTAINMENT'
  | 'MEDICAL'
  | 'BILLS'
  | 'EMI'
  | 'INSURANCE'
  | 'EDUCATION'
  | 'OTHERS';

export type PaymentMode = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'NET_BANKING' | 'BANK_TRANSFER' | 'OTHER';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'FOOD',
  'RENT',
  'FUEL',
  'SHOPPING',
  'TRAVEL',
  'ENTERTAINMENT',
  'MEDICAL',
  'BILLS',
  'EMI',
  'INSURANCE',
  'EDUCATION',
  'OTHERS',
];

export const PAYMENT_MODES: PaymentMode[] = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'NET_BANKING', 'BANK_TRANSFER', 'OTHER'];

export type RecurrenceInterval = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export const RECURRENCE_INTERVALS: RecurrenceInterval[] = ['WEEKLY', 'MONTHLY', 'YEARLY'];

export interface ExpenseSplit {
  id?: string;
  participantName: string;
  amount: number;
  isSettled?: boolean;
}

export interface Expense {
  id: string;
  userId: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  paymentMode: PaymentMode;
  description?: string | null;
  bankAccountId?: string | null;
  isRecurring: boolean;
  recurrenceInterval?: RecurrenceInterval | null;
  recurrenceEndDate?: string | null;
  nextRecurrenceDate?: string | null;
  parentExpenseId?: string | null;
  receiptUrl?: string | null;
  familyMemberId?: string | null;
  familyMemberName?: string | null;
  splits?: ExpenseSplit[];
  createdAt: string;
}

export interface ExpenseFormValue {
  date: string;
  category: ExpenseCategory;
  amount: number;
  paymentMode: PaymentMode;
  description?: string;
  bankAccountId?: string;
  isRecurring?: boolean;
  recurrenceInterval?: RecurrenceInterval;
  recurrenceEndDate?: string;
  splits?: ExpenseSplit[];
  familyMemberId?: string | null;
  receiptUrl?: string;
}

export interface ReceiptScanResult {
  amount: number | null;
  date: string | null;
  category: ExpenseCategory | null;
  description: string | null;
  receiptUrl: string;
}

export interface SpendingTrends {
  monthly: { label: string; amount: number }[];
  byCategory: { category: string; amount: number }[];
}

export interface ExpenseSplitParticipantBalance {
  participantName: string;
  totalOwed: number;
  unsettledCount: number;
}

export interface UnsettledExpenseSplit {
  id: string;
  expenseId: string;
  participantName: string;
  amount: number;
  isSettled: boolean;
  expenseDescription?: string | null;
  expenseCategory: ExpenseCategory;
  expenseDate: string;
}

export interface ExpenseSplitsSummary {
  byParticipant: ExpenseSplitParticipantBalance[];
  unsettledSplits: UnsettledExpenseSplit[];
}

export interface ExpenseListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  category?: ExpenseCategory;
  from?: string;
  to?: string;
  familyMemberId?: string;
}
