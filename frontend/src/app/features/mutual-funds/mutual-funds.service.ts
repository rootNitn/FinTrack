import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { MutualFundDashboard, MutualFundDetail } from './mutual-funds.model';

@Injectable({ providedIn: 'root' })
export class MutualFundsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/mutual-funds';

  getDashboard(): Observable<MutualFundDashboard> {
    return this.api.get<MutualFundDashboard>(`${this.basePath}/dashboard`);
  }

  getFundDetail(key: string): Observable<MutualFundDetail> {
    return this.api.get<MutualFundDetail>(`${this.basePath}/funds/${encodeURIComponent(key)}`);
  }
}
