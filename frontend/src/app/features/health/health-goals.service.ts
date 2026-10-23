import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { HealthGoal, HealthGoalFormValue } from './health.model';

@Injectable({ providedIn: 'root' })
export class HealthGoalsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/health/goals';

  list(): Observable<HealthGoal[]> {
    return this.api.get<HealthGoal[]>(this.basePath);
  }

  create(payload: HealthGoalFormValue): Observable<HealthGoal> {
    return this.api.post<HealthGoal>(this.basePath, payload);
  }

  update(id: string, payload: Partial<HealthGoalFormValue>): Observable<HealthGoal> {
    return this.api.patch<HealthGoal>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }
}
