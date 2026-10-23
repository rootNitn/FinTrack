export type IncomeSource = 'SALARY' | 'FREELANCING' | 'INTEREST' | 'DIVIDEND' | 'RENTAL_INCOME' | 'OTHER_INCOME';

export const INCOME_SOURCES: IncomeSource[] = ['SALARY', 'FREELANCING', 'INTEREST', 'DIVIDEND', 'RENTAL_INCOME', 'OTHER_INCOME'];

export type RecurrenceInterval = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export const RECURRENCE_INTERVALS: RecurrenceInterval[] = ['WEEKLY', 'MONTHLY', 'YEARLY'];

export interface Income {
  id: string;
  userId: string;
  date: string;
  source: IncomeSource;
  amount: number;
  description?: string | null;
  bankAccountId?: string | null;
  bankAccount?: { bankName: string } | null;
  familyMemberId?: string | null;
  familyMember?: { name: string } | null;
  isRecurring: boolean;
  recurrenceInterval?: RecurrenceInterval | null;
  recurrenceEndDate?: string | null;
  nextRecurrenceDate?: string | null;
  parentIncomeId?: string | null;
  createdAt: string;
}

export interface IncomeFormValue {
  date: string;
  source: IncomeSource;
  amount: number;
  description?: string;
  bankAccountId?: string;
  familyMemberId?: string | null;
  isRecurring?: boolean;
  recurrenceInterval?: RecurrenceInterval;
  recurrenceEndDate?: string;
}

export interface IncomeListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  source?: IncomeSource;
  bankAccountId?: string;
  familyMemberId?: string;
  from?: string;
  to?: string;
}

export interface IncomeSummary {
  totalIncome: number;
  salary: number;
  interest: number;
  other: number;
}

export type IncomeSummaryParams = Omit<IncomeListParams, 'page' | 'limit' | 'sortBy' | 'sortDir'>;

