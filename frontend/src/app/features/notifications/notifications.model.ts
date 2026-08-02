export type NotificationType =
  | 'FD_MATURITY'
  | 'SIP_REMINDER'
  | 'GOAL_ACHIEVEMENT'
  | 'MONTHLY_SUMMARY'
  | 'LARGE_EXPENSE_ALERT'
  | 'FD_RATE_CHANGE'
  | 'HIGHER_FD_RATE_AVAILABLE'
  | 'FD_RENEWAL_REMINDER'
  | 'CC_PAYMENT_DUE'
  | 'EMI_DUE'
  | 'BUDGET_EXCEEDED'
  | 'INSURANCE_RENEWAL'
  | 'BIRTHDAY_REMINDER'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}
