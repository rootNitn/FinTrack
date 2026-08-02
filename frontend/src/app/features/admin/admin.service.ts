import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService, QueryParams } from '../../core/services/api-base.service';
import { PaginationMeta } from '../../core/models/api-response.model';
import { AdminAnalytics, AdminListParams, AdminUser, AuditLogEntry, AuditLogListParams } from './admin.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/admin';

  listUsers(params: AdminListParams): Observable<{ data: AdminUser[]; meta?: PaginationMeta }> {
    return this.api.getWithMeta<AdminUser[]>(`${this.basePath}/users`, params as QueryParams);
  }

  setUserActive(userId: string, isActive: boolean): Observable<AdminUser> {
    return this.api.patch<AdminUser>(`${this.basePath}/users/${userId}/active`, { isActive });
  }

  setUserRole(userId: string, role: 'USER' | 'ADMIN'): Observable<AdminUser> {
    return this.api.patch<AdminUser>(`${this.basePath}/users/${userId}/role`, { role });
  }

  getAnalytics(): Observable<AdminAnalytics> {
    return this.api.get<AdminAnalytics>(`${this.basePath}/analytics`);
  }

  listAuditLogs(params: AuditLogListParams): Observable<{ data: AuditLogEntry[]; meta?: PaginationMeta }> {
    return this.api.getWithMeta<AuditLogEntry[]>(`${this.basePath}/audit-logs`, params as QueryParams);
  }
}
