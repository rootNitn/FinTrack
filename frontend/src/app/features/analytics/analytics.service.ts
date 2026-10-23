import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { AnalyticsResult } from './analytics.model';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/analytics';

  getAnalytics(startDate?: string, endDate?: string): Observable<AnalyticsResult> {
    return this.api.get<AnalyticsResult>(this.basePath, { startDate, endDate });
  }

  exportExcel(startDate?: string, endDate?: string): Observable<Blob> {
    return this.api.getBlob(`${this.basePath}/export/excel`, { startDate, endDate });
  }

  exportPdf(startDate?: string, endDate?: string): Observable<Blob> {
    return this.api.getBlob(`${this.basePath}/export/pdf`, { startDate, endDate });
  }
}
