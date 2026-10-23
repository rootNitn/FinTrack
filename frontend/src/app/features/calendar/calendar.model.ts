export type CalendarDataType = 'EXPENSE' | 'INCOME' | 'INVESTMENT_BUY' | 'INVESTMENT_SELL' | 'SIP' | 'TRANSFER';

export interface CalendarTransaction {
  id: string;
  type: CalendarDataType;
  amount: number;
  date: string;
  description?: string;
  category?: string;
  color?: string;
}

export interface CalendarDay {
  date: Date;
  transactions: CalendarTransaction[];
  totalAmount: number;
}

export interface CalendarMonth {
  month: number;
  year: number;
  days: CalendarDay[];
}
