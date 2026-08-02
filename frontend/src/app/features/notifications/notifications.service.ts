import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { AppNotification } from './notifications.model';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/notifications';

  list(unreadOnly = false): Observable<AppNotification[]> {
    return this.api.get<AppNotification[]>(this.basePath, unreadOnly ? { unreadOnly: true } : undefined);
  }

  unreadCount(): Observable<{ count: number }> {
    return this.api.get<{ count: number }>(`${this.basePath}/unread-count`);
  }

  markRead(id: string): Observable<AppNotification> {
    return this.api.patch<AppNotification>(`${this.basePath}/${id}/read`, {});
  }

  markAllRead(): Observable<{ updatedCount: number }> {
    return this.api.patch<{ updatedCount: number }>(`${this.basePath}/mark-all-read`, {});
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }
}
