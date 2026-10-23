import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { DailyWellnessFormValue, DailyWellnessLog } from './health.model';

@Injectable({ providedIn: 'root' })
export class DailyLogService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/health/daily-log';

  list(days?: number): Observable<DailyWellnessLog[]> {
    return this.api.get<DailyWellnessLog[]>(this.basePath, days ? { days } : undefined);
  }

  today(): Observable<DailyWellnessLog | null> {
    return this.api.get<DailyWellnessLog | null>(`${this.basePath}/today`);
  }

  getByDate(date: string): Observable<DailyWellnessLog | null> {
    return this.api.get<DailyWellnessLog | null>(`${this.basePath}/${date}`);
  }

  upsert(date: string, payload: DailyWellnessFormValue): Observable<DailyWellnessLog> {
    return this.api.put<DailyWellnessLog>(`${this.basePath}/${date}`, payload);
  }
}
