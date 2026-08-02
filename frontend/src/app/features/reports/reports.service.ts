import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService, QueryParams } from '../../core/services/api-base.service';
import { Report, ReportQuery } from './reports.model';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/reports';

  generate(query: ReportQuery): Observable<Report> {
    return this.api.get<Report>(this.basePath, query as unknown as QueryParams);
  }

  exportExcel(query: ReportQuery): Observable<Blob> {
    return this.api.getBlob(`${this.basePath}/export/excel`, query as unknown as QueryParams);
  }

  exportCsv(query: ReportQuery): Observable<Blob> {
    return this.api.getBlob(`${this.basePath}/export/csv`, query as unknown as QueryParams);
  }

  exportPdf(query: ReportQuery): Observable<Blob> {
    return this.api.getBlob(`${this.basePath}/export/pdf`, query as unknown as QueryParams);
  }
}
