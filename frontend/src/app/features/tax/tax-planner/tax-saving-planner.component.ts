import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { TaxService } from '../tax.service';
import { TaxPlannerService } from './tax-planner.service';
import { StructuredTaxSavingSuggestion } from './tax-planner.model';
import { TaxFinancialYearSummary } from '../tax.model';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-tax-saving-planner',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './tax-saving-planner.component.html',
})
export class TaxSavingPlannerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly taxService = inject(TaxService);
  private readonly plannerService = inject(TaxPlannerService);
  private readonly toast = inject(ToastService);

  readonly financialYears = signal<TaxFinancialYearSummary[]>([]);
  readonly generating = signal(false);
  readonly suggestions = signal<StructuredTaxSavingSuggestion[] | null>(null);
  readonly noCalculationFound = signal(false);
  readonly currency = currency;

  readonly financialYearCode = this.fb.nonNullable.control('', Validators.required);

  ngOnInit(): void {
    this.taxService.listFinancialYears().subscribe({
      next: (years) => {
        this.financialYears.set(years);
        const defaultYear = years.find((y) => y.isDefault) ?? years[0];
        if (defaultYear) this.financialYearCode.setValue(defaultYear.code);
      },
    });
  }

  generate(): void {
    if (!this.financialYearCode.value) return;
    this.generating.set(true);
    this.noCalculationFound.set(false);
    this.plannerService.generate(this.financialYearCode.value).subscribe({
      next: (result) => {
        this.suggestions.set(result.suggestions);
        this.generating.set(false);
      },
      error: (err) => {
        this.generating.set(false);
        if (err?.status === 400) {
          this.noCalculationFound.set(true);
        } else {
          this.toast.error('Failed to generate tax saving plan');
        }
      },
    });
  }
}
