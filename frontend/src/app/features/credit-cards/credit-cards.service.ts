import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import {
  CreditCard,
  CreditCardDetail,
  CreditCardFormValue,
  CreditCardPayment,
  CreditCardStatement,
  CreditCardSummary,
  PaymentFormValue,
  RedeemFormValue,
  StatementFormValue,
} from './credit-cards.model';

@Injectable({ providedIn: 'root' })
export class CreditCardsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/credit-cards';

  list(): Observable<CreditCard[]> {
    return this.api.get<CreditCard[]>(this.basePath);
  }

  summary(): Observable<CreditCardSummary> {
    return this.api.get<CreditCardSummary>(`${this.basePath}/summary`);
  }

  getById(id: string): Observable<CreditCardDetail> {
    return this.api.get<CreditCardDetail>(`${this.basePath}/${id}`);
  }

  create(payload: CreditCardFormValue): Observable<CreditCard> {
    return this.api.post<CreditCard>(this.basePath, payload);
  }

  update(id: string, payload: Partial<CreditCardFormValue>): Observable<CreditCard> {
    return this.api.patch<CreditCard>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }

  listStatements(cardId: string): Observable<CreditCardStatement[]> {
    return this.api.get<CreditCardStatement[]>(`${this.basePath}/${cardId}/statements`);
  }

  createStatement(cardId: string, payload: StatementFormValue): Observable<CreditCardStatement> {
    return this.api.post<CreditCardStatement>(`${this.basePath}/${cardId}/statements`, payload);
  }

  updateStatement(cardId: string, statementId: string, payload: Partial<StatementFormValue>): Observable<CreditCardStatement> {
    return this.api.patch<CreditCardStatement>(`${this.basePath}/${cardId}/statements/${statementId}`, payload);
  }

  removeStatement(cardId: string, statementId: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${cardId}/statements/${statementId}`);
  }

  listPayments(cardId: string): Observable<CreditCardPayment[]> {
    return this.api.get<CreditCardPayment[]>(`${this.basePath}/${cardId}/payments`);
  }

  recordPayment(cardId: string, payload: PaymentFormValue): Observable<CreditCardPayment> {
    return this.api.post<CreditCardPayment>(`${this.basePath}/${cardId}/payments`, payload);
  }

  redeem(cardId: string, payload: RedeemFormValue): Observable<CreditCard> {
    return this.api.post<CreditCard>(`${this.basePath}/${cardId}/redeem`, payload);
  }
}
