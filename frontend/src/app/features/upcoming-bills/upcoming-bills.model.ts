export type UpcomingBillType = 'SIP' | 'EMI' | 'INSURANCE' | 'CREDIT_CARD' | 'FD_MATURITY';

export interface UpcomingBillItem {
  id: string;
  type: UpcomingBillType;
  title: string;
  dueDate: string;
  amount: number;
  overdue: boolean;
}

export interface UpcomingBillsResult {
  windowDays: number;
  items: UpcomingBillItem[];
  overdueCount: number;
  totalOutgoing: number;
}

export const UPCOMING_BILL_TYPE_ICONS: Record<UpcomingBillType, string> = {
  SIP: 'trending_up',
  EMI: 'account_balance',
  INSURANCE: 'health_and_safety',
  CREDIT_CARD: 'credit_card',
  FD_MATURITY: 'savings',
};

export const UPCOMING_BILL_TYPE_LABELS: Record<UpcomingBillType, string> = {
  SIP: 'SIP',
  EMI: 'EMI',
  INSURANCE: 'Insurance',
  CREDIT_CARD: 'Credit card',
  FD_MATURITY: 'FD maturity',
};
