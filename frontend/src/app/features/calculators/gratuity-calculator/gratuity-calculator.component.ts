import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { TaxExemptionCalculatorsService } from '../tax-exemption-calculators.service';
import { GratuityCalculationResult } from '../tax-exemption-calculators.model';
import { ToastService } from '../../../core/services/toast.service';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-gratuity-calculator',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    KpiCardComponent,
  ],
  templateUrl: './gratuity-calculator.component.html',
})
export class GratuityCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(TaxExemptionCalculatorsService);
  private readonly toast = inject(ToastService);

  readonly calculating = signal(false);
  readonly result = signal<GratuityCalculationResult | null>(null);
  readonly currency = currency;

  readonly form = this.fb.nonNullable.group({
    employeeType: ['NON_GOVERNMENT' as 'GOVERNMENT' | 'NON_GOVERNMENT', Validators.required],
    gratuityReceived: [1000000, [Validators.required, Validators.min(0)]],
    lastDrawnSalary: [80000, [Validators.required, Validators.min(0)]],
    yearsOfService: [15, [Validators.required, Validators.min(0)]],
    isCoveredUnderGratuityAct: [true],
  });

  calculate(): void {
    if (this.form.invalid) return;
    this.calculating.set(true);
    this.service.calculateGratuity(this.form.getRawValue()).subscribe({
      next: (result) => {
        this.result.set(result);
        this.calculating.set(false);
      },
      error: () => {
        this.toast.error('Failed to calculate gratuity exemption');
        this.calculating.set(false);
      },
    });
  }
}
