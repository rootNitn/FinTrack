import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { AnalyticsResult } from './analytics.model';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/analytics';

  getAnalytics(): Observable<AnalyticsResult> {
    return this.api.get<AnalyticsResult>(this.basePath);
  }
}
