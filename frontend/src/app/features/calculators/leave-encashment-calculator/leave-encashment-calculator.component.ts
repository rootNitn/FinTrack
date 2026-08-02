import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { TaxExemptionCalculatorsService } from '../tax-exemption-calculators.service';
import { LeaveEncashmentCalculationResult } from '../tax-exemption-calculators.model';
import { ToastService } from '../../../core/services/toast.service';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-leave-encashment-calculator',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    KpiCardComponent,
  ],
  templateUrl: './leave-encashment-calculator.component.html',
})
export class LeaveEncashmentCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(TaxExemptionCalculatorsService);
  private readonly toast = inject(ToastService);

  readonly calculating = signal(false);
  readonly result = signal<LeaveEncashmentCalculationResult | null>(null);
  readonly currency = currency;

  readonly form = this.fb.nonNullable.group({
    employeeType: ['NON_GOVERNMENT' as 'GOVERNMENT' | 'NON_GOVERNMENT', Validators.required],
    leaveEncashmentReceived: [500000, [Validators.required, Validators.min(0)]],
    avgMonthlySalaryLast10Months: [80000, [Validators.required, Validators.min(0)]],
    leaveDaysEncashed: [180, [Validators.required, Validators.min(0)]],
    yearsOfService: [15, [Validators.required, Validators.min(0)]],
  });

  calculate(): void {
    if (this.form.invalid) return;
    this.calculating.set(true);
    this.service.calculateLeaveEncashment(this.form.getRawValue()).subscribe({
      next: (result) => {
        this.result.set(result);
        this.calculating.set(false);
      },
      error: () => {
        this.toast.error('Failed to calculate leave encashment exemption');
        this.calculating.set(false);
      },
    });
  }
}
