import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService, QueryParams } from '../../core/services/api-base.service';
import { PaginationMeta } from '../../core/models/api-response.model';
import { ImportResult, Investment, InvestmentCategorySummary, InvestmentFormValue, InvestmentListParams } from './investments.model';

@Injectable({ providedIn: 'root' })
export class InvestmentsService {
  private readonly api = inject(ApiBaseService);

  list(params: InvestmentListParams): Observable<{ data: Investment[]; meta?: PaginationMeta }> {
    return this.api.getWithMeta<Investment[]>('/investments', params as QueryParams);
  }

  getCategorySummary(): Observable<InvestmentCategorySummary[]> {
    return this.api.get<InvestmentCategorySummary[]>('/investments/category-summary');
  }

  getById(id: string): Observable<Investment> {
    return this.api.get<Investment>(`/investments/${id}`);
  }

  create(payload: InvestmentFormValue): Observable<Investment> {
    return this.api.post<Investment>('/investments', payload);
  }

  update(id: string, payload: Partial<InvestmentFormValue>): Observable<Investment> {
    return this.api.patch<Investment>(`/investments/${id}`, payload);
  }

  remove(id: string): Observable<unknown> {
    return this.api.delete(`/investments/${id}`);
  }

  bulkDelete(ids: string[]): Observable<unknown> {
    return this.api.post('/investments/bulk-delete', { ids });
  }

  exportExcel(): Observable<Blob> {
    return this.api.getBlob('/investments/export/excel');
  }

  exportPdf(): Observable<Blob> {
    return this.api.getBlob('/investments/export/pdf');
  }

  import(file: File): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<ImportResult>('/investments/import', formData);
  }

  refreshPrices(): Observable<{ total: number; updated: number; skipped: number; failed: number }> {
    return this.api.post('/investments/refresh-prices', {});
  }
}
