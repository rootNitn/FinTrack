import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { FdPortfolioEntry, FdPortfolioFormValue, FdPortfolioSummary } from './fd.model';

@Injectable({ providedIn: 'root' })
export class FdPortfolioService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/fd/portfolio';

  list(familyMemberId?: string): Observable<FdPortfolioEntry[]> {
    return this.api.get<FdPortfolioEntry[]>(this.basePath, familyMemberId ? { familyMemberId } : undefined);
  }

  getSummary(): Observable<FdPortfolioSummary> {
    return this.api.get<FdPortfolioSummary>(`${this.basePath}/summary`);
  }

  getById(id: string): Observable<FdPortfolioEntry> {
    return this.api.get<FdPortfolioEntry>(`${this.basePath}/${id}`);
  }

  create(payload: FdPortfolioFormValue): Observable<FdPortfolioEntry> {
    return this.api.post<FdPortfolioEntry>(this.basePath, payload);
  }

  update(id: string, payload: Partial<FdPortfolioFormValue>): Observable<FdPortfolioEntry> {
    return this.api.patch<FdPortfolioEntry>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }
}
