import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { MarketRate } from './market-rates.model';

@Injectable({ providedIn: 'root' })
export class MarketRatesService {
  private readonly api = inject(ApiBaseService);

  list(): Observable<MarketRate[]> {
    return this.api.get<MarketRate[]>('/market-rates');
  }
}
