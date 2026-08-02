import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { TaxService } from '../tax.service';
import { TaxDashboardData, TaxFinancialYearSummary } from '../tax.model';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number | null): string {
  return value === null ? '-' : formatCurrency(value, { maximumFractionDigits: 0 });
}

const QUICK_LINKS = [
  { label: 'Tax Calculator', icon: 'calculate', route: '/tax/calculator' },
  { label: 'Capital Gains', icon: 'trending_up', route: '/tax/capital-gains' },
  { label: 'Advance Tax', icon: 'event_available', route: '/tax/advance-tax' },
  { label: 'Tax Saving Planner', icon: 'savings', route: '/tax/planner' },
  { label: 'Documents', icon: 'description', route: '/tax/documents' },
  { label: 'Filing Workspace', icon: 'rocket_launch', route: '/tax/workspace' },
];

@Component({
  selector: 'app-tax-dashboard',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    KpiCardComponent,
  ],
  templateUrl: './tax-dashboard.component.html',
})
export class TaxDashboardComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly taxService = inject(TaxService);

  readonly financialYears = signal<TaxFinancialYearSummary[]>([]);
  readonly loading = signal(true);
  readonly data = signal<TaxDashboardData | null>(null);
  readonly currency = currency;
  readonly quickLinks = QUICK_LINKS;

  readonly financialYearCode = this.fb.nonNullable.control('');

  ngOnInit(): void {
    this.taxService.listFinancialYears().subscribe({
      next: (years) => {
        this.financialYears.set(years);
        const defaultYear = years.find((y) => y.isDefault) ?? years[0];
        if (defaultYear) {
          this.financialYearCode.setValue(defaultYear.code);
          this.load(defaultYear.code);
        } else {
          this.loading.set(false);
        }
      },
      error: () => this.loading.set(false),
    });

    this.financialYearCode.valueChanges.subscribe((code) => {
      if (code) this.load(code);
    });
  }

  private load(financialYearCode: string): void {
    this.loading.set(true);
    this.taxService.getDashboard(financialYearCode).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  severityIcon(severity: string): string {
    if (severity === 'warning') return 'warning';
    if (severity === 'success') return 'check_circle';
    return 'info';
  }
}
