import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Budget, BudgetFormValue, BudgetSummary } from './budgets.model';

@Injectable({ providedIn: 'root' })
export class BudgetsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/budgets';

  getSummary(month: number, year: number): Observable<BudgetSummary> {
    return this.api.get<BudgetSummary>(this.basePath, { month, year });
  }

  upsert(payload: BudgetFormValue): Observable<Budget> {
    return this.api.post<Budget>(this.basePath, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }
}
