import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { WorkoutFormValue, WorkoutLog } from './health.model';

@Injectable({ providedIn: 'root' })
export class WorkoutsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/health/workouts';

  list(limit?: number): Observable<WorkoutLog[]> {
    return this.api.get<WorkoutLog[]>(this.basePath, limit ? { limit } : undefined);
  }

  create(payload: WorkoutFormValue): Observable<WorkoutLog> {
    return this.api.post<WorkoutLog>(this.basePath, payload);
  }

  update(id: string, payload: Partial<WorkoutFormValue>): Observable<WorkoutLog> {
    return this.api.patch<WorkoutLog>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }
}
