import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { InvestmentComparisonFilters, InvestmentComparisonResult } from './investment-comparison.model';

@Injectable({ providedIn: 'root' })
export class InvestmentComparisonService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/investment-comparison';

  compare(filters: InvestmentComparisonFilters): Observable<InvestmentComparisonResult> {
    return this.api.get<InvestmentComparisonResult>(
      this.basePath,
      filters as unknown as Record<string, string | number | boolean | null | undefined>
    );
  }
}
