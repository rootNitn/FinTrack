import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { FinancialLevelSummary } from './financial-level.model';

@Injectable({ providedIn: 'root' })
export class FinancialLevelService {
  private readonly api = inject(ApiBaseService);

  getSummary(): Observable<FinancialLevelSummary> {
    return this.api.get<FinancialLevelSummary>('/financial-level/summary');
  }
}
