import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { TaxSavingPlanResult } from './tax-planner.model';

@Injectable({ providedIn: 'root' })
export class TaxPlannerService {
  private readonly api = inject(ApiBaseService);

  generate(financialYearCode: string): Observable<TaxSavingPlanResult> {
    return this.api.post<TaxSavingPlanResult>('/tax-planner', { financialYearCode });
  }
}
