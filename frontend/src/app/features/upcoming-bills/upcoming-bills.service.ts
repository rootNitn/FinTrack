import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { UpcomingBillsResult } from './upcoming-bills.model';

@Injectable({ providedIn: 'root' })
export class UpcomingBillsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/upcoming-bills';

  get(days: number): Observable<UpcomingBillsResult> {
    return this.api.get<UpcomingBillsResult>(this.basePath, { days });
  }
}
