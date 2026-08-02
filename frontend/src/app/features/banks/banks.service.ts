import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { BankAccount, BankAccountFormValue } from './banks.model';

@Injectable({ providedIn: 'root' })
export class BanksService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/banks';

  list(): Observable<BankAccount[]> {
    return this.api.get<BankAccount[]>(this.basePath);
  }

  getById(id: string): Observable<BankAccount> {
    return this.api.get<BankAccount>(`${this.basePath}/${id}`);
  }

  create(payload: BankAccountFormValue): Observable<BankAccount> {
    return this.api.post<BankAccount>(this.basePath, payload);
  }

  update(id: string, payload: Partial<BankAccountFormValue>): Observable<BankAccount> {
    return this.api.patch<BankAccount>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }
}
