import { ExpenseCategory } from '../expenses/expenses.model';

export interface Budget {
  id: string;
  userId: string;
  category: ExpenseCategory | null;
  month: number;
  year: number;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetFormValue {
  category?: ExpenseCategory | null;
  month: number;
  year: number;
  amount: number;
}

export interface BudgetSummaryItem {
  id: string;
  category: ExpenseCategory | null;
  month: number;
  year: number;
  amount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
}

export interface BudgetSummary {
  items: BudgetSummaryItem[];
  totalSpent: number;
}
