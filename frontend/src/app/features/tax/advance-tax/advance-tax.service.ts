import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { AdvanceTaxCalculationResult, AdvanceTaxInstallmentInput } from './advance-tax.model';

@Injectable({ providedIn: 'root' })
export class AdvanceTaxService {
  private readonly api = inject(ApiBaseService);

  calculate(input: {
    financialYearCode: string;
    estimatedTaxLiability: number;
    tdsAlreadyDeducted: number;
    installments: AdvanceTaxInstallmentInput[];
  }): Observable<AdvanceTaxCalculationResult> {
    return this.api.post<AdvanceTaxCalculationResult>('/advance-tax/calculate', input);
  }
}
