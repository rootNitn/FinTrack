import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse } from '../models/api-response.model';
import {
  CreateOrderPayload,
  CreateOrderResponse,
  CurrentPlan,
  Subscription,
  VerifyPaymentPayload,
} from '../models/billing.model';

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getCurrentPlan(): Observable<CurrentPlan> {
    return this.http.get<ApiSuccessResponse<CurrentPlan>>(`${this.baseUrl}/billing/me`).pipe(map((res) => res.data));
  }

  listSubscriptions(): Observable<Subscription[]> {
    return this.http
      .get<ApiSuccessResponse<Subscription[]>>(`${this.baseUrl}/billing/subscriptions`)
      .pipe(map((res) => res.data));
  }

  createOrder(payload: CreateOrderPayload): Observable<CreateOrderResponse> {
    return this.http
      .post<ApiSuccessResponse<CreateOrderResponse>>(`${this.baseUrl}/billing/create-order`, payload)
      .pipe(map((res) => res.data));
  }

  verifyPayment(payload: VerifyPaymentPayload): Observable<CurrentPlan> {
    return this.http
      .post<ApiSuccessResponse<CurrentPlan>>(`${this.baseUrl}/billing/verify-payment`, payload)
      .pipe(map((res) => res.data));
  }
}
