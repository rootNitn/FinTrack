import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Goal, GoalContribution, GoalFormValue } from './goals.model';

@Injectable({ providedIn: 'root' })
export class GoalsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/goals';

  list(familyMemberId?: string): Observable<Goal[]> {
    return this.api.get<Goal[]>(this.basePath, familyMemberId ? { familyMemberId } : undefined);
  }

  getById(id: string): Observable<Goal> {
    return this.api.get<Goal>(`${this.basePath}/${id}`);
  }

  create(payload: GoalFormValue): Observable<Goal> {
    return this.api.post<Goal>(this.basePath, payload);
  }

  update(id: string, payload: Partial<GoalFormValue>): Observable<Goal> {
    return this.api.patch<Goal>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }

  addContribution(id: string, amount: number, date?: string, note?: string): Observable<Goal> {
    return this.api.post<Goal>(`${this.basePath}/${id}/contribute`, { amount, date, note });
  }

  contributions(id: string): Observable<GoalContribution[]> {
    return this.api.get<GoalContribution[]>(`${this.basePath}/${id}/contributions`);
  }
}
