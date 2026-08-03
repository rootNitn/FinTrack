import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Settings, UpdateSettingsPayload } from './settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiBaseService);

  get(): Observable<Settings> {
    return this.api.get<Settings>('/settings');
  }

  update(payload: UpdateSettingsPayload): Observable<Settings> {
    return this.api.patch<Settings>('/settings', payload);
  }

  downloadBackup(): Observable<Blob> {
    return this.api.getBlob('/settings/backup');
  }

  restoreBackup(data: unknown): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/settings/restore', data);
  }
}
