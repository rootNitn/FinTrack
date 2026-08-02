import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';

export interface TaxReconciliationReport {
  financialYearCode: string;
  aisWarnings: string[];
  form26asWarnings: string[];
}

@Injectable({ providedIn: 'root' })
export class ReconciliationService {
  private readonly api = inject(ApiBaseService);

  getReport(financialYearCode: string): Observable<TaxReconciliationReport> {
    return this.api.get<TaxReconciliationReport>('/reconciliation', { financialYearCode });
  }
}
