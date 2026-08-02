import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { ToastService } from '../../../core/services/toast.service';
import { TaxService } from '../tax.service';
import { AdvanceTaxService } from './advance-tax.service';
import { AdvanceTaxCalculationResult } from './advance-tax.model';
import { TaxFinancialYearSummary } from '../tax.model';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-advance-tax-calculator',
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
  templateUrl: './advance-tax-calculator.component.html',
})
export class AdvanceTaxCalculatorComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly taxService = inject(TaxService);
  private readonly advanceTaxService = inject(AdvanceTaxService);
  private readonly toast = inject(ToastService);

  readonly financialYears = signal<TaxFinancialYearSummary[]>([]);
  readonly calculating = signal(false);
  readonly result = signal<AdvanceTaxCalculationResult | null>(null);
  readonly currency = currency;

  readonly form = this.fb.nonNullable.group({
    financialYearCode: ['', Validators.required],
    estimatedTaxLiability: [0, [Validators.required, Validators.min(0)]],
    tdsAlreadyDeducted: [0, [Validators.min(0)]],
    q1Paid: [0, [Validators.min(0)]],
    q2Paid: [0, [Validators.min(0)]],
    q3Paid: [0, [Validators.min(0)]],
    q4Paid: [0, [Validators.min(0)]],
  });

  ngOnInit(): void {
    this.taxService.listFinancialYears().subscribe({
      next: (years) => {
        this.financialYears.set(years);
        const defaultYear = years.find((y) => y.isDefault) ?? years[0];
        if (defaultYear) this.form.controls.financialYearCode.setValue(defaultYear.code);
      },
    });
  }

  calculate(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.calculating.set(true);
    this.advanceTaxService
      .calculate({
        financialYearCode: v.financialYearCode,
        estimatedTaxLiability: v.estimatedTaxLiability,
        tdsAlreadyDeducted: v.tdsAlreadyDeducted,
        installments: [
          { quarter: 'Q1', paidAmount: v.q1Paid },
          { quarter: 'Q2', paidAmount: v.q2Paid },
          { quarter: 'Q3', paidAmount: v.q3Paid },
          { quarter: 'Q4', paidAmount: v.q4Paid },
        ],
      })
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.calculating.set(false);
          this.toast.success('Advance tax calculated and saved');
        },
        error: () => {
          this.toast.error('Failed to calculate advance tax');
          this.calculating.set(false);
        },
      });
  }
}
