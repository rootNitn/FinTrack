import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService, QueryParams } from '../../core/services/api-base.service';
import { PaginationMeta } from '../../core/models/api-response.model';
import { Expense, ExpenseFormValue, ExpenseListParams, ExpenseSplitsSummary, ReceiptScanResult, SpendingTrends } from './expenses.model';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/expenses';

  list(params: ExpenseListParams): Observable<{ data: Expense[]; meta?: PaginationMeta }> {
    return this.api.getWithMeta<Expense[]>(this.basePath, params as QueryParams);
  }

  getById(id: string): Observable<Expense> {
    return this.api.get<Expense>(`${this.basePath}/${id}`);
  }

  create(payload: ExpenseFormValue): Observable<Expense> {
    return this.api.post<Expense>(this.basePath, payload);
  }

  update(id: string, payload: Partial<ExpenseFormValue>): Observable<Expense> {
    return this.api.patch<Expense>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }

  /** Exports the same filtered set `list()` would return. */
  exportExcel(params: Partial<ExpenseListParams>): Observable<Blob> {
    return this.api.getBlob(`${this.basePath}/export/excel`, params as QueryParams);
  }

  uploadReceipt(id: string, file: File): Observable<Expense> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<Expense>(`${this.basePath}/${id}/receipt`, formData);
  }

  /** OCRs a receipt file and returns suggested expense fields, without creating/updating anything. */
  scanReceipt(file: File): Observable<ReceiptScanResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<ReceiptScanResult>(`${this.basePath}/scan-receipt`, formData);
  }

  getSpendingTrends(months?: number): Observable<SpendingTrends> {
    return this.api.get<SpendingTrends>(`${this.basePath}/trends/spending`, months ? { months } : undefined);
  }

  setSplitSettled(expenseId: string, splitId: string, isSettled: boolean): Observable<unknown> {
    return this.api.patch(`${this.basePath}/${expenseId}/splits/${splitId}`, { isSettled });
  }

  getSplitsSummary(): Observable<ExpenseSplitsSummary> {
    return this.api.get<ExpenseSplitsSummary>(`${this.basePath}/splits/summary`);
  }
}
