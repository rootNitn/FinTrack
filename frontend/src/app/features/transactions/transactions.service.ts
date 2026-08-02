import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService, QueryParams } from '../../core/services/api-base.service';
import { PaginationMeta } from '../../core/models/api-response.model';
import { Transaction, TransactionListParams } from './transactions.model';

@Injectable({ providedIn: 'root' })
export class TransactionsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/transactions';

  list(params: TransactionListParams): Observable<{ data: Transaction[]; meta?: PaginationMeta }> {
    return this.api.getWithMeta<Transaction[]>(this.basePath, params as QueryParams);
  }

  recent(limit = 8): Observable<Transaction[]> {
    return this.api.get<Transaction[]>(`${this.basePath}/recent`, { limit });
  }
}
