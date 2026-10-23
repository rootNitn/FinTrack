import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import {
  CreateInsurancePolicyPayload,
  CreateLiabilityPayload,
  DebtPayoffStrategyResult,
  FinancialHealthSummary,
  InsurancePolicy,
  Liability,
  LiabilityAmortization,
  PrepaymentImpact,
} from './financial-health.model';

@Injectable({ providedIn: 'root' })
export class FinancialHealthService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/financial-health';

  getSummary(): Observable<FinancialHealthSummary> {
    return this.api.get<FinancialHealthSummary>(`${this.basePath}/summary`);
  }

  listLiabilities(): Observable<Liability[]> {
    return this.api.get<Liability[]>('/liabilities');
  }

  createLiability(payload: CreateLiabilityPayload): Observable<Liability> {
    return this.api.post<Liability>('/liabilities', payload);
  }

  deleteLiability(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/liabilities/${id}`);
  }

  getLiabilityAmortization(id: string): Observable<LiabilityAmortization> {
    return this.api.get<LiabilityAmortization>(`/liabilities/${id}/amortization`);
  }

  getPrepaymentImpact(id: string, extraMonthlyPayment: number, lumpSum: number): Observable<PrepaymentImpact> {
    return this.api.post<PrepaymentImpact>(`/liabilities/${id}/prepayment-impact`, { extraMonthlyPayment, lumpSum });
  }

  getDebtPayoffStrategy(extraMonthlyBudget: number): Observable<DebtPayoffStrategyResult> {
    return this.api.get<DebtPayoffStrategyResult>('/liabilities/debt-payoff-strategy', { extraMonthlyBudget });
  }

  listInsurancePolicies(): Observable<InsurancePolicy[]> {
    return this.api.get<InsurancePolicy[]>('/insurance');
  }

  createInsurancePolicy(payload: CreateInsurancePolicyPayload): Observable<InsurancePolicy> {
    return this.api.post<InsurancePolicy>('/insurance', payload);
  }

  deleteInsurancePolicy(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/insurance/${id}`);
  }
}

