import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService, QueryParams } from '../../core/services/api-base.service';
import { PaginationMeta } from '../../core/models/api-response.model';
import { Income, IncomeFormValue, IncomeListParams } from './income.model';

@Injectable({ providedIn: 'root' })
export class IncomeService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/income';

  list(params: IncomeListParams): Observable<{ data: Income[]; meta?: PaginationMeta }> {
    return this.api.getWithMeta<Income[]>(this.basePath, params as QueryParams);
  }

  getById(id: string): Observable<Income> {
    return this.api.get<Income>(`${this.basePath}/${id}`);
  }

  create(payload: IncomeFormValue): Observable<Income> {
    return this.api.post<Income>(this.basePath, payload);
  }

  update(id: string, payload: Partial<IncomeFormValue>): Observable<Income> {
    return this.api.patch<Income>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }
}
