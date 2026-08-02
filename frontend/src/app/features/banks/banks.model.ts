export type AccountType = 'SAVINGS' | 'CURRENT' | 'SALARY' | 'NRI' | 'OTHER';

export const ACCOUNT_TYPES: AccountType[] = ['SAVINGS', 'CURRENT', 'SALARY', 'NRI', 'OTHER'];

export interface BankAccount {
  id: string;
  userId: string;
  bankName: string;
  accountType: AccountType;
  balance: number;
  ifsc: string;
  accountNumber: string; // masked, e.g. "****1234"
  lastUpdated: string;
  createdAt: string;
}

export interface BankAccountFormValue {
  bankName: string;
  accountType: AccountType;
  balance: number;
  ifsc: string;
  accountNumber?: string; // omit on update to keep existing number
}
