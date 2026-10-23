import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { BodyMetricFormValue, BodyMetricLog } from './health.model';

@Injectable({ providedIn: 'root' })
export class BodyMetricsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/health/body-metrics';

  list(limit?: number): Observable<BodyMetricLog[]> {
    return this.api.get<BodyMetricLog[]>(this.basePath, limit ? { limit } : undefined);
  }

  latest(): Observable<BodyMetricLog | null> {
    return this.api.get<BodyMetricLog | null>(`${this.basePath}/latest`);
  }

  create(payload: BodyMetricFormValue): Observable<BodyMetricLog> {
    return this.api.post<BodyMetricLog>(this.basePath, payload);
  }

  update(id: string, payload: Partial<BodyMetricFormValue>): Observable<BodyMetricLog> {
    return this.api.patch<BodyMetricLog>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }
}
