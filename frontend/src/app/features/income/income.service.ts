import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService, QueryParams } from '../../core/services/api-base.service';
import { PaginationMeta } from '../../core/models/api-response.model';
import { Income, IncomeFormValue, IncomeListParams, IncomeSummary, IncomeSummaryParams } from './income.model';
import { IncomeSourceProfile, IncomeSourceProfilePayload } from './income-source.model';

@Injectable({ providedIn: 'root' })
export class IncomeService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/income';

  list(params: IncomeListParams): Observable<{ data: Income[]; meta?: PaginationMeta }> {
    return this.api.getWithMeta<Income[]>(this.basePath, params as QueryParams);
  }

  summary(params: IncomeSummaryParams): Observable<IncomeSummary> {
    return this.api.get<IncomeSummary>(`${this.basePath}/summary`, params as QueryParams);
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

  /** Exports the same filtered set `list()` would return. */
  exportExcel(params: Partial<IncomeListParams>): Observable<Blob> {
    return this.api.getBlob(`${this.basePath}/export/excel`, params as QueryParams);
  }

  createSource(payload: IncomeSourceProfilePayload): Observable<IncomeSourceProfile> {
    return this.api.post<IncomeSourceProfile>('/income-sources', payload);
  }

  listSources(): Observable<IncomeSourceProfile[]> {
    return this.api.get<IncomeSourceProfile[]>('/income-sources');
  }

  updateSource(id: string, payload: Partial<IncomeSourceProfilePayload>): Observable<IncomeSourceProfile> {
    return this.api.patch<IncomeSourceProfile>(`/income-sources/${id}`, payload);
  }

  removeSource(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/income-sources/${id}`);
  }
}
