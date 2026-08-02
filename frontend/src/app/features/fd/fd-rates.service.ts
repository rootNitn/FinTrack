import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { downloadBlob } from '../../shared/utils/file-download.util';
import { FdComparisonFilters, FdComparisonRow, FdRate, FdRateFormValue } from './fd.model';

@Injectable({ providedIn: 'root' })
export class FdRatesService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/fd/rates';

  compare(filters: FdComparisonFilters): Observable<FdComparisonRow[]> {
    return this.api.get<FdComparisonRow[]>(this.basePath, filters as Record<string, string | number | boolean | null | undefined>);
  }

  listByBank(bankId: string): Observable<FdRate[]> {
    return this.api.get<FdRate[]>(`${this.basePath}/bank/${bankId}`);
  }

  create(payload: FdRateFormValue): Observable<FdRate> {
    return this.api.post<FdRate>(this.basePath, payload);
  }

  update(id: string, payload: Partial<FdRateFormValue>): Observable<FdRate> {
    return this.api.patch<FdRate>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }

  exportExcel(filters: FdComparisonFilters): void {
    this.api
      .getBlob(`${this.basePath}/export/excel`, filters as Record<string, string | number | boolean | null | undefined>)
      .subscribe((blob) => downloadBlob(blob, 'fd-comparison.xlsx'));
  }

  exportPdf(filters: FdComparisonFilters): void {
    this.api
      .getBlob(`${this.basePath}/export/pdf`, filters as Record<string, string | number | boolean | null | undefined>)
      .subscribe((blob) => downloadBlob(blob, 'fd-comparison.pdf'));
  }
}
