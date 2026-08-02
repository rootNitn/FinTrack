import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { FdBank, FdBankFormValue, FdImportResult } from './fd.model';

@Injectable({ providedIn: 'root' })
export class FdBanksService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/fd/banks';

  list(filters?: { search?: string; bankType?: string; activeOnly?: boolean }): Observable<FdBank[]> {
    return this.api.get<FdBank[]>(this.basePath, filters);
  }

  getById(id: string): Observable<FdBank> {
    return this.api.get<FdBank>(`${this.basePath}/${id}`);
  }

  create(payload: FdBankFormValue): Observable<FdBank> {
    return this.api.post<FdBank>(this.basePath, payload);
  }

  update(id: string, payload: Partial<FdBankFormValue>): Observable<FdBank> {
    return this.api.patch<FdBank>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }

  import(file: File): Observable<FdImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<FdImportResult>(`${this.basePath}/import`, formData);
  }
}
