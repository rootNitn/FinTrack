import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService, QueryParams } from '../../core/services/api-base.service';
import { PaginationMeta } from '../../core/models/api-response.model';
import { Transaction, TransactionListParams, TransactionSummary, TransactionSummaryParams } from './transactions.model';

@Injectable({ providedIn: 'root' })
export class TransactionsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/transactions';

  list(params: TransactionListParams): Observable<{ data: Transaction[]; meta?: PaginationMeta }> {
    return this.api.getWithMeta<Transaction[]>(this.basePath, params as QueryParams);
  }

  summary(params: TransactionSummaryParams): Observable<TransactionSummary> {
    return this.api.get<TransactionSummary>(`${this.basePath}/summary`, params as QueryParams);
  }

  categories(): Observable<string[]> {
    return this.api.get<string[]>(`${this.basePath}/categories`);
  }

  recent(limit = 8): Observable<Transaction[]> {
    return this.api.get<Transaction[]>(`${this.basePath}/recent`, { limit });
  }

  exportExcel(params: TransactionListParams): Observable<Blob> {
    return this.api.getBlob(`${this.basePath}/export/excel`, params as QueryParams);
  }
}
