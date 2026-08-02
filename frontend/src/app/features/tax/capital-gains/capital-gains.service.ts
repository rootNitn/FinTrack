import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { CapitalGainsCalculationResult, CapitalGainsTransactionInput } from './capital-gains.model';

@Injectable({ providedIn: 'root' })
export class CapitalGainsService {
  private readonly api = inject(ApiBaseService);

  calculate(financialYearCode: string, transactions: CapitalGainsTransactionInput[]): Observable<CapitalGainsCalculationResult> {
    return this.api.post<CapitalGainsCalculationResult>('/capital-gains/calculate', { financialYearCode, transactions });
  }

  list(financialYearCode?: string): Observable<CapitalGainsCalculationResult> {
    return this.api.get<CapitalGainsCalculationResult>('/capital-gains', { financialYearCode });
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/capital-gains/${id}`);
  }
}
