import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import {
  TaxCalculationInput,
  TaxCalculationRecord,
  TaxComparisonResult,
  TaxDashboardData,
  TaxFinancialYearRuleSet,
  TaxFinancialYearSummary,
  TaxWhatIfOverrides,
} from './tax.model';

export interface TaxHistoryPage {
  data: TaxCalculationRecord[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable({ providedIn: 'root' })
export class TaxService {
  private readonly api = inject(ApiBaseService);

  listFinancialYears(): Observable<TaxFinancialYearSummary[]> {
    return this.api.get<TaxFinancialYearSummary[]>('/tax/financial-years');
  }

  getSlabs(financialYearCode?: string): Observable<TaxFinancialYearRuleSet> {
    return this.api.get<TaxFinancialYearRuleSet>('/tax/slabs', { financialYearCode });
  }

  getDashboard(financialYearCode: string): Observable<TaxDashboardData> {
    return this.api.get<TaxDashboardData>('/tax/dashboard', { financialYearCode });
  }

  calculate(input: TaxCalculationInput): Observable<TaxComparisonResult> {
    return this.api.post<TaxComparisonResult>('/tax/calculate', input);
  }

  whatIf(input: TaxCalculationInput, overrides: TaxWhatIfOverrides): Observable<TaxComparisonResult> {
    return this.api.post<TaxComparisonResult>('/tax/what-if', { ...input, overrides });
  }

  save(payload: {
    financialYearCode: string;
    label?: string;
    selectedRegime?: 'OLD' | 'NEW';
    inputs: TaxCalculationInput;
    result: TaxComparisonResult;
  }): Observable<TaxCalculationRecord> {
    return this.api.post<TaxCalculationRecord>('/tax/save', payload);
  }

  history(page: number, limit: number): Observable<TaxHistoryPage> {
    return this.api.getWithMeta<TaxCalculationRecord[]>('/tax/history', { page, limit });
  }

  getHistoryItem(id: string): Observable<TaxCalculationRecord> {
    return this.api.get<TaxCalculationRecord>(`/tax/history/${id}`);
  }

  deleteHistoryItem(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/tax/history/${id}`);
  }

  exportExcel(input: TaxCalculationInput) {
    return this.api.postBlob('/tax/export/excel', input);
  }

  exportPdf(input: TaxCalculationInput) {
    return this.api.postBlob('/tax/export/pdf', input);
  }

  exportHistoryItemExcel(id: string) {
    return this.api.getBlob(`/tax/history/${id}/export/excel`);
  }

  exportHistoryItemPdf(id: string) {
    return this.api.getBlob(`/tax/history/${id}/export/pdf`);
  }
}
