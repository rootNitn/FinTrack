export interface NotificationPreferences {
  fdMaturity: boolean;
  sipReminder: boolean;
  goalAchievement: boolean;
  monthlySummary: boolean;
  largeExpenseAlert: boolean;
  fdRateChange: boolean;
  higherFdRateAvailable: boolean;
  fdRenewalReminder: boolean;
  ccPaymentDue: boolean;
  emiDue: boolean;
  budgetExceeded: boolean;
  insuranceRenewal: boolean;
  birthdayReminder: boolean;
  medicationReminder: boolean;
  appointmentReminder: boolean;
  healthGoalAchievement: boolean;
}

export interface DashboardWidgetLayout {
  id: string;
  visible: boolean;
}

export interface Settings {
  id: string;
  userId: string;
  currency: string;
  theme: 'light' | 'dark';
  notificationPreferences: NotificationPreferences;
  largeExpenseThreshold: number;
  dashboardLayout: DashboardWidgetLayout[];
  /** User-chosen target allocation for the Financial Health Rebalancing Score. Null = 60/30/10 default. */
  targetEquityPercent: number | null;
  targetDebtPercent: number | null;
  targetGoldPercent: number | null;
  /** Retirement Readiness / FI Ratio inputs. Null expense = fall back to current monthly expenses; null rate = 4%. */
  retirementMonthlyExpense: number | null;
  retirementWithdrawalRatePercent: number | null;
  /** "IN" keeps financialYearStartMonth fixed at 4 (April) to match India's legally-mandated fiscal year used by the Tax module. */
  country: string;
  financialYearStartMonth: number;
  /** Opt-out of the AI Chat widget. Does not affect AI Insights (rule-based, no LLM calls, always on). */
  aiChatEnabled: boolean;
  updatedAt: string;
}

export interface UpdateSettingsPayload {
  currency?: string;
  theme?: 'light' | 'dark';
  largeExpenseThreshold?: number;
  notificationPreferences?: Partial<NotificationPreferences>;
  dashboardLayout?: DashboardWidgetLayout[];
  targetEquityPercent?: number | null;
  targetDebtPercent?: number | null;
  targetGoldPercent?: number | null;
  retirementMonthlyExpense?: number | null;
  retirementWithdrawalRatePercent?: number | null;
  country?: string;
  financialYearStartMonth?: number;
  aiChatEnabled?: boolean;
}
