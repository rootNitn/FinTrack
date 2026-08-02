import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { AiInsightsResult } from './ai-insights.model';

@Injectable({ providedIn: 'root' })
export class AiInsightsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/ai-insights';

  getInsights(): Observable<AiInsightsResult> {
    return this.api.get<AiInsightsResult>(this.basePath);
  }
}
