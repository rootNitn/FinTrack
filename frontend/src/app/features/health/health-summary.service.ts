import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { HealthSummary } from './health.model';

@Injectable({ providedIn: 'root' })
export class HealthSummaryService {
  private readonly api = inject(ApiBaseService);

  get(): Observable<HealthSummary> {
    return this.api.get<HealthSummary>('/health/summary');
  }
}
