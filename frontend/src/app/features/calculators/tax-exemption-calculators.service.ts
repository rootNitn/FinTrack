import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { GratuityCalculationResult, HraCalculationResult, LeaveEncashmentCalculationResult } from './tax-exemption-calculators.model';

@Injectable({ providedIn: 'root' })
export class TaxExemptionCalculatorsService {
  private readonly api = inject(ApiBaseService);

  calculateHra(input: { basicSalary: number; hraReceived: number; rentPaid: number; state: string }): Observable<HraCalculationResult> {
    return this.api.post<HraCalculationResult>('/hra/calculate', input);
  }

  calculateGratuity(input: {
    employeeType: 'GOVERNMENT' | 'NON_GOVERNMENT';
    gratuityReceived: number;
    lastDrawnSalary: number;
    yearsOfService: number;
    isCoveredUnderGratuityAct: boolean;
  }): Observable<GratuityCalculationResult> {
    return this.api.post<GratuityCalculationResult>('/gratuity/calculate', input);
  }

  calculateLeaveEncashment(input: {
    employeeType: 'GOVERNMENT' | 'NON_GOVERNMENT';
    leaveEncashmentReceived: number;
    avgMonthlySalaryLast10Months: number;
    leaveDaysEncashed: number;
    yearsOfService: number;
  }): Observable<LeaveEncashmentCalculationResult> {
    return this.api.post<LeaveEncashmentCalculationResult>('/leave-encashment/calculate', input);
  }
}
