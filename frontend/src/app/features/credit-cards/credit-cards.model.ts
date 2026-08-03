export type CardNetwork = 'VISA' | 'MASTERCARD' | 'RUPAY' | 'AMEX' | 'DINERS' | 'OTHER';

export const CARD_NETWORKS: CardNetwork[] = ['VISA', 'MASTERCARD', 'RUPAY', 'AMEX', 'DINERS', 'OTHER'];

export const CARD_NETWORK_LABELS: Record<CardNetwork, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  RUPAY: 'RuPay',
  AMEX: 'American Express',
  DINERS: 'Diners Club',
  OTHER: 'Other',
};

export type StatementStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export const STATEMENT_STATUS_LABELS: Record<StatementStatus, string> = {
  UNPAID: 'Unpaid',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
};

export type UtilizationLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface CreditCard {
  id: string;
  userId: string;
  cardName: string;
  bankName: string;
  network: CardNetwork;
  cardNumber: string; // masked
  creditLimit: number;
  currentOutstanding: number;
  statementDay: number;
  paymentDueDays: number;
  rewardPointsBalance: number;
  cashbackBalance: number;
  annualFee: number;
  interestRatePercent: number;
  isActive: boolean;
  notes: string | null;
  familyMemberId?: string | null;
  familyMemberName?: string | null;
  createdAt: string;
  updatedAt: string;
  utilizationPercent: number;
  utilizationLevel: UtilizationLevel;
  nextDueDate: string;
  daysUntilDue: number;
  isDueSoon: boolean;
}

export interface CreditCardStatement {
  id: string;
  cardId: string;
  userId: string;
  month: number;
  year: number;
  statementDate: string;
  dueDate: string;
  totalDue: number;
  minimumDue: number;
  paidAmount: number;
  rewardPointsEarned: number;
  cashbackEarned: number;
  status: StatementStatus;
  createdAt: string;
  updatedAt: string;
  daysUntilDue: number;
}

export interface CreditCardPayment {
  id: string;
  cardId: string;
  statementId: string | null;
  userId: string;
  amount: number;
  paidDate: string;
  method: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreditCardDetail extends CreditCard {
  statements: CreditCardStatement[];
  payments: CreditCardPayment[];
}

export interface DueSoonStatement {
  statementId: string;
  cardId: string;
  cardName: string;
  dueDate: string;
  amountDue: number;
  daysUntilDue: number;
  status: StatementStatus;
}

export interface CreditCardSummary {
  cardCount: number;
  totalLimit: number;
  totalOutstanding: number;
  overallUtilizationPercent: number;
  totalRewardPoints: number;
  totalCashback: number;
  dueSoon: DueSoonStatement[];
}

export interface CreditCardFormValue {
  cardName: string;
  bankName: string;
  network: CardNetwork;
  cardNumber?: string; // omit on update to keep existing number
  creditLimit: number;
  currentOutstanding: number;
  statementDay: number;
  paymentDueDays: number;
  annualFee: number;
  interestRatePercent: number;
  notes?: string;
  familyMemberId?: string | null;
}

export interface StatementFormValue {
  month: number;
  year: number;
  statementDate: string;
  dueDate: string;
  totalDue: number;
  minimumDue: number;
  rewardPointsEarned: number;
  cashbackEarned: number;
}

export interface PaymentFormValue {
  amount: number;
  paidDate: string;
  statementId?: string;
  method?: string;
  notes?: string;
}

export interface RedeemFormValue {
  type: 'POINTS' | 'CASHBACK';
  amount: number;
}
