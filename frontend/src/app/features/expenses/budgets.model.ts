import { ExpenseCategory } from '../expenses/expenses.model';

export interface Budget {
  id: string;
  userId: string;
  category: ExpenseCategory | null;
  month: number;
  year: number;
  amount: number;
  familyMemberId?: string | null;
  familyMemberName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetFormValue {
  category?: ExpenseCategory | null;
  month: number;
  year: number;
  amount: number;
  familyMemberId?: string | null;
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
  familyMemberId?: string | null;
  familyMemberName?: string | null;
}

export interface BudgetSummary {
  items: BudgetSummaryItem[];
  totalSpent: number;
}
