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
  updatedAt: string;
}

export interface UpdateSettingsPayload {
  currency?: string;
  theme?: 'light' | 'dark';
  largeExpenseThreshold?: number;
  notificationPreferences?: Partial<NotificationPreferences>;
  dashboardLayout?: DashboardWidgetLayout[];
}
