export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
}

export interface AdminAnalytics {
  totalUsers: number;
  activeUsers: number;
  totalInvestments: number;
  totalExpenses: number;
  totalIncome: number;
  totalInvestedAcrossUsers: number;
  totalCurrentValueAcrossUsers: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  createdAt: string;
}

export interface AdminListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface AuditLogListParams {
  page?: number;
  limit?: number;
  action?: string;
  entity?: string;
}
