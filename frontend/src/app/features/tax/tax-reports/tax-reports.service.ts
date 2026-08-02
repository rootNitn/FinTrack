import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { TaxReportTable, TaxReportType } from './tax-reports.model';

@Injectable({ providedIn: 'root' })
export class TaxReportsService {
  private readonly api = inject(ApiBaseService);

  getReport(financialYearCode: string, reportType: TaxReportType): Observable<TaxReportTable> {
    return this.api.get<TaxReportTable>('/tax/reports', { financialYearCode, reportType });
  }

  exportExcel(financialYearCode: string, reportType: TaxReportType): Observable<Blob> {
    return this.api.getBlob('/tax/reports/export/excel', { financialYearCode, reportType });
  }

  exportPdf(financialYearCode: string, reportType: TaxReportType): Observable<Blob> {
    return this.api.getBlob('/tax/reports/export/pdf', { financialYearCode, reportType });
  }
}
