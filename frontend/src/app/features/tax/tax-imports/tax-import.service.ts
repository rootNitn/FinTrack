import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { TaxImportRecord, TaxImportType } from './tax-import.model';

const BASE_PATHS: Record<TaxImportType, string> = {
  'salary-slip': '/salary-slip',
  form16: '/form16',
  ais: '/ais',
  form26as: '/form26as',
};

export interface TaxReconciliationReport {
  financialYearCode: string;
  aisWarnings: string[];
  form26asWarnings: string[];
}

@Injectable({ providedIn: 'root' })
export class TaxImportService {
  private readonly api = inject(ApiBaseService);

  import(type: TaxImportType, file: File, financialYearCode: string): Observable<TaxImportRecord> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('financialYearCode', financialYearCode);
    return this.api.post<TaxImportRecord>(`${BASE_PATHS[type]}/import`, formData);
  }

  list(type: TaxImportType, financialYearCode?: string): Observable<TaxImportRecord[]> {
    return this.api.get<TaxImportRecord[]>(BASE_PATHS[type], financialYearCode ? { financialYearCode } : undefined);
  }

  get(type: TaxImportType, id: string): Observable<TaxImportRecord> {
    return this.api.get<TaxImportRecord>(`${BASE_PATHS[type]}/${id}`);
  }

  update(type: TaxImportType, id: string, input: Record<string, unknown>): Observable<TaxImportRecord> {
    return this.api.patch<TaxImportRecord>(`${BASE_PATHS[type]}/${id}`, input);
  }

  /**
   * Retries import of a password-protected PDF. The password is sent once in the request body
   * and is never persisted by this service — the caller is responsible for clearing it from any
   * form state immediately after this call settles.
   */
  unlock(type: TaxImportType, documentId: string, password: string): Observable<TaxImportRecord> {
    return this.api.post<TaxImportRecord>(`${BASE_PATHS[type]}/${documentId}/unlock`, { password });
  }

  delete(type: TaxImportType, id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${BASE_PATHS[type]}/${id}`);
  }

  reconciliation(financialYearCode: string): Observable<TaxReconciliationReport> {
    return this.api.get<TaxReconciliationReport>('/reconciliation', { financialYearCode });
  }
}
