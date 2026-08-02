import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import {
  CostInflationIndexAdmin,
  TaxCapitalGainRuleAdmin,
  TaxCessRuleAdmin,
  TaxDeductionRuleAdmin,
  TaxFinancialYearAdmin,
  TaxFinancialYearDetail,
  TaxRebateRuleAdmin,
  TaxSlabAdmin,
  TaxSurchargeRuleAdmin,
  TaxValidationRuleAdmin,
} from './tax-admin.model';

@Injectable({ providedIn: 'root' })
export class TaxAdminService {
  private readonly api = inject(ApiBaseService);
  private readonly base = '/tax/admin';

  // Financial years
  listFinancialYears(): Observable<TaxFinancialYearAdmin[]> {
    return this.api.get<TaxFinancialYearAdmin[]>(`${this.base}/financial-years`);
  }
  getFinancialYear(id: string): Observable<TaxFinancialYearDetail> {
    return this.api.get<TaxFinancialYearDetail>(`${this.base}/financial-years/${id}`);
  }
  createFinancialYear(payload: Partial<TaxFinancialYearAdmin>): Observable<TaxFinancialYearAdmin> {
    return this.api.post<TaxFinancialYearAdmin>(`${this.base}/financial-years`, payload);
  }
  updateFinancialYear(id: string, payload: Partial<TaxFinancialYearAdmin>): Observable<TaxFinancialYearAdmin> {
    return this.api.patch<TaxFinancialYearAdmin>(`${this.base}/financial-years/${id}`, payload);
  }
  deleteFinancialYear(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.base}/financial-years/${id}`);
  }

  // Slabs
  createSlab(payload: Partial<TaxSlabAdmin>): Observable<TaxSlabAdmin> {
    return this.api.post<TaxSlabAdmin>(`${this.base}/slabs`, payload);
  }
  updateSlab(id: string, payload: Partial<TaxSlabAdmin>): Observable<TaxSlabAdmin> {
    return this.api.patch<TaxSlabAdmin>(`${this.base}/slabs/${id}`, payload);
  }
  deleteSlab(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.base}/slabs/${id}`);
  }

  // Rebate rules
  createRebateRule(payload: Partial<TaxRebateRuleAdmin>): Observable<TaxRebateRuleAdmin> {
    return this.api.post<TaxRebateRuleAdmin>(`${this.base}/rebate-rules`, payload);
  }
  updateRebateRule(id: string, payload: Partial<TaxRebateRuleAdmin>): Observable<TaxRebateRuleAdmin> {
    return this.api.patch<TaxRebateRuleAdmin>(`${this.base}/rebate-rules/${id}`, payload);
  }
  deleteRebateRule(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.base}/rebate-rules/${id}`);
  }

  // Surcharge rules
  createSurchargeRule(payload: Partial<TaxSurchargeRuleAdmin>): Observable<TaxSurchargeRuleAdmin> {
    return this.api.post<TaxSurchargeRuleAdmin>(`${this.base}/surcharge-rules`, payload);
  }
  updateSurchargeRule(id: string, payload: Partial<TaxSurchargeRuleAdmin>): Observable<TaxSurchargeRuleAdmin> {
    return this.api.patch<TaxSurchargeRuleAdmin>(`${this.base}/surcharge-rules/${id}`, payload);
  }
  deleteSurchargeRule(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.base}/surcharge-rules/${id}`);
  }

  // Cess rules
  createCessRule(payload: Partial<TaxCessRuleAdmin>): Observable<TaxCessRuleAdmin> {
    return this.api.post<TaxCessRuleAdmin>(`${this.base}/cess-rules`, payload);
  }
  updateCessRule(id: string, payload: Partial<TaxCessRuleAdmin>): Observable<TaxCessRuleAdmin> {
    return this.api.patch<TaxCessRuleAdmin>(`${this.base}/cess-rules/${id}`, payload);
  }
  deleteCessRule(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.base}/cess-rules/${id}`);
  }

  // Deduction rules
  createDeductionRule(payload: Partial<TaxDeductionRuleAdmin>): Observable<TaxDeductionRuleAdmin> {
    return this.api.post<TaxDeductionRuleAdmin>(`${this.base}/deduction-rules`, payload);
  }
  updateDeductionRule(id: string, payload: Partial<TaxDeductionRuleAdmin>): Observable<TaxDeductionRuleAdmin> {
    return this.api.patch<TaxDeductionRuleAdmin>(`${this.base}/deduction-rules/${id}`, payload);
  }
  deleteDeductionRule(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.base}/deduction-rules/${id}`);
  }

  // Capital gain rules
  listCapitalGainRules(): Observable<TaxCapitalGainRuleAdmin[]> {
    return this.api.get<TaxCapitalGainRuleAdmin[]>(`${this.base}/capital-gain-rules`);
  }
  createCapitalGainRule(payload: Partial<TaxCapitalGainRuleAdmin>): Observable<TaxCapitalGainRuleAdmin> {
    return this.api.post<TaxCapitalGainRuleAdmin>(`${this.base}/capital-gain-rules`, payload);
  }
  updateCapitalGainRule(id: string, payload: Partial<TaxCapitalGainRuleAdmin>): Observable<TaxCapitalGainRuleAdmin> {
    return this.api.patch<TaxCapitalGainRuleAdmin>(`${this.base}/capital-gain-rules/${id}`, payload);
  }
  deleteCapitalGainRule(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.base}/capital-gain-rules/${id}`);
  }

  // Cost Inflation Index
  listCostInflationIndices(): Observable<CostInflationIndexAdmin[]> {
    return this.api.get<CostInflationIndexAdmin[]>(`${this.base}/cost-inflation-index`);
  }
  createCostInflationIndex(payload: Partial<CostInflationIndexAdmin>): Observable<CostInflationIndexAdmin> {
    return this.api.post<CostInflationIndexAdmin>(`${this.base}/cost-inflation-index`, payload);
  }
  updateCostInflationIndex(id: string, payload: Partial<CostInflationIndexAdmin>): Observable<CostInflationIndexAdmin> {
    return this.api.patch<CostInflationIndexAdmin>(`${this.base}/cost-inflation-index/${id}`, payload);
  }
  deleteCostInflationIndex(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.base}/cost-inflation-index/${id}`);
  }

  // Validation rules
  listValidationRules(): Observable<TaxValidationRuleAdmin[]> {
    return this.api.get<TaxValidationRuleAdmin[]>(`${this.base}/validation-rules`);
  }
  createValidationRule(payload: Partial<TaxValidationRuleAdmin>): Observable<TaxValidationRuleAdmin> {
    return this.api.post<TaxValidationRuleAdmin>(`${this.base}/validation-rules`, payload);
  }
  updateValidationRule(id: string, payload: Partial<TaxValidationRuleAdmin>): Observable<TaxValidationRuleAdmin> {
    return this.api.patch<TaxValidationRuleAdmin>(`${this.base}/validation-rules/${id}`, payload);
  }
  deleteValidationRule(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.base}/validation-rules/${id}`);
  }
}
