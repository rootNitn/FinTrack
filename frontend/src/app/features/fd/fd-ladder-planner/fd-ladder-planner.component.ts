import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { ToastService } from '../../../core/services/toast.service';
import { FdCalculatorService } from '../fd-calculator.service';
import { FdLadderPlan } from '../fd.model';

import { formatCurrency } from '../../../shared/utils/currency.util';
import { formatDate } from '../../../shared/utils/date.util';

const DEFAULT_RUNGS = [1, 2, 3, 5];

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-fd-ladder-planner',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    PageHeaderComponent,
    KpiCardComponent,
  ],
  templateUrl: './fd-ladder-planner.component.html',
  styleUrl: './fd-ladder-planner.component.scss',
})
export class FdLadderPlannerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly calculatorService = inject(FdCalculatorService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly plan = signal<FdLadderPlan | null>(null);

  readonly form = this.fb.nonNullable.group({
    totalAmount: [500000, [Validators.required, Validators.min(1)]],
    fdType: ['REGULAR' as 'REGULAR' | 'SENIOR', Validators.required],
    rungsText: [DEFAULT_RUNGS.join(', '), Validators.required],
  });

  constructor() {
    this.build();
  }

  build(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const rungs = value.rungsText
      .split(',')
      .map((v) => parseInt(v.trim(), 10))
      .filter((v) => !Number.isNaN(v) && v > 0);

    if (rungs.length === 0) {
      this.toast.error('Enter at least one valid tenure year for the ladder.');
      return;
    }

    this.loading.set(true);
    this.calculatorService.buildLadderPlan({ totalAmount: value.totalAmount, fdType: value.fdType, rungs }).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  currency(value: number): string {
    return currency(value);
  }

  maturityDateLabel(date: string | null): string {
    return date ? formatDate(date) : '—';
  }
}
