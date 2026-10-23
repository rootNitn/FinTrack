import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { BankImportColumns, BankImportCommitEntry, BankImportCommitResult, BankImportMapping, BankImportReconcileResult } from './bank-import.model';

@Injectable({ providedIn: 'root' })
export class BankImportService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/bank-import';

  getColumns(file: File): Observable<BankImportColumns> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<BankImportColumns>(`${this.basePath}/columns`, formData);
  }

  reconcile(file: File, mapping: BankImportMapping): Observable<BankImportReconcileResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));
    return this.api.post<BankImportReconcileResult>(`${this.basePath}/reconcile`, formData);
  }

  commit(entries: BankImportCommitEntry[]): Observable<BankImportCommitResult> {
    return this.api.post<BankImportCommitResult>(`${this.basePath}/commit`, { entries });
  }
}
