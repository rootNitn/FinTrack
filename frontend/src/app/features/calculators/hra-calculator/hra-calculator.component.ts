import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { TaxExemptionCalculatorsService } from '../tax-exemption-calculators.service';
import { HraCalculationResult } from '../tax-exemption-calculators.model';
import { ToastService } from '../../../core/services/toast.service';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-hra-calculator',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, PageHeaderComponent, KpiCardComponent],
  templateUrl: './hra-calculator.component.html',
})
export class HraCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(TaxExemptionCalculatorsService);
  private readonly toast = inject(ToastService);

  readonly calculating = signal(false);
  readonly result = signal<HraCalculationResult | null>(null);
  readonly currency = currency;

  readonly form = this.fb.nonNullable.group({
    basicSalary: [600000, [Validators.required, Validators.min(0)]],
    hraReceived: [240000, [Validators.required, Validators.min(0)]],
    rentPaid: [216000, [Validators.required, Validators.min(0)]],
    state: ['Maharashtra', Validators.required],
  });

  calculate(): void {
    if (this.form.invalid) return;
    this.calculating.set(true);
    this.service.calculateHra(this.form.getRawValue()).subscribe({
      next: (result) => {
        this.result.set(result);
        this.calculating.set(false);
      },
      error: () => {
        this.toast.error('Failed to calculate HRA exemption');
        this.calculating.set(false);
      },
    });
  }
}
