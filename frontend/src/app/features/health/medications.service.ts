import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Medication, MedicationFormValue, MedicationLog } from './health.model';

@Injectable({ providedIn: 'root' })
export class MedicationsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/health/medications';

  list(activeOnly?: boolean): Observable<Medication[]> {
    return this.api.get<Medication[]>(this.basePath, activeOnly ? { activeOnly: true } : undefined);
  }

  getById(id: string): Observable<Medication> {
    return this.api.get<Medication>(`${this.basePath}/${id}`);
  }

  create(payload: MedicationFormValue): Observable<Medication> {
    return this.api.post<Medication>(this.basePath, payload);
  }

  update(id: string, payload: Partial<MedicationFormValue>): Observable<Medication> {
    return this.api.patch<Medication>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }

  logDose(id: string, status: 'TAKEN' | 'MISSED' | 'SKIPPED', scheduledFor: string): Observable<MedicationLog> {
    return this.api.post<MedicationLog>(`${this.basePath}/${id}/log`, { status, scheduledFor });
  }

  getLogs(id: string, limit?: number): Observable<MedicationLog[]> {
    return this.api.get<MedicationLog[]>(`${this.basePath}/${id}/logs`, limit ? { limit } : undefined);
  }
}
