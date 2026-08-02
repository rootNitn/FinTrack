import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { FdCalculateInput, FdCalculationResult, FdLadderPlan, FdLadderPlanInput } from './fd.model';

@Injectable({ providedIn: 'root' })
export class FdCalculatorService {
  private readonly api = inject(ApiBaseService);

  calculate(payload: FdCalculateInput): Observable<FdCalculationResult> {
    return this.api.post<FdCalculationResult>('/fd/calculate', payload);
  }

  buildLadderPlan(payload: FdLadderPlanInput): Observable<FdLadderPlan> {
    return this.api.post<FdLadderPlan>('/fd/ladder-plan', payload);
  }
}
