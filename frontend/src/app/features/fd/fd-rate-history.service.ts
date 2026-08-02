import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { FdRateHistoryPoint, FdTrendPrediction, RateHistoryRange } from './fd.model';

@Injectable({ providedIn: 'root' })
export class FdRateHistoryService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/fd/rate-history';

  getHistory(bankId: string, tenureLabel: string, range: RateHistoryRange): Observable<FdRateHistoryPoint[]> {
    return this.api.get<FdRateHistoryPoint[]>(`${this.basePath}/${bankId}`, { tenureLabel, range });
  }

  getTrendPrediction(bankId: string, tenureLabel: string): Observable<FdTrendPrediction> {
    return this.api.get<FdTrendPrediction>(`${this.basePath}/${bankId}/trend`, { tenureLabel });
  }
}
