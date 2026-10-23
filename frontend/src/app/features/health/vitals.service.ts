import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { VitalFormValue, VitalLog, VitalType } from './health.model';

@Injectable({ providedIn: 'root' })
export class VitalsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/health/vitals';

  list(type?: VitalType, limit?: number): Observable<VitalLog[]> {
    return this.api.get<VitalLog[]>(this.basePath, { type, limit });
  }

  create(payload: VitalFormValue): Observable<VitalLog> {
    return this.api.post<VitalLog>(this.basePath, payload);
  }

  update(id: string, payload: Partial<VitalFormValue>): Observable<VitalLog> {
    return this.api.patch<VitalLog>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }
}
