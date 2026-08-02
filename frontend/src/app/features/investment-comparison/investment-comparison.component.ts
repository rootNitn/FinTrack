import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { EChartsCoreOption } from 'echarts/core';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card.component';
import { CHART_PALETTE } from '../../shared/charts/chart-style.util';
import { ToastService } from '../../core/services/toast.service';
import { InvestmentComparisonService } from './investment-comparison.service';
import {
  INVESTMENT_TYPE_LABELS,
  LIQUIDITY_LABELS,
  RISK_LEVEL_LABELS,
  InvestmentComparisonFilters,
  InvestmentComparisonResult,
} from './investment-comparison.model';
import { formatCurrency } from '../../shared/utils/currency.util';

const TENURE_OPTIONS = [
  { label: '3 Months', years: 0.25 },
  { label: '6 Months', years: 0.5 },
  { label: '1 Year', years: 1 },
  { label: '3 Years', years: 3 },
  { label: '5 Years', years: 5 },
  { label: '10 Years', years: 10 },
  { label: '15 Years', years: 15 },
];

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-investment-comparison',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    PageHeaderComponent,
    SkeletonLoaderComponent,
    ChartCardComponent,
  ],
  templateUrl: './investment-comparison.component.html',
  styleUrl: './investment-comparison.component.scss',
})
export class InvestmentComparisonComponent implements OnInit {
  private readonly comparisonService = inject(InvestmentComparisonService);
  private readonly toast = inject(ToastService);

  readonly tenureOptions = TENURE_OPTIONS;
  readonly typeLabels = INVESTMENT_TYPE_LABELS;
  readonly riskLabels = RISK_LEVEL_LABELS;
  readonly liquidityLabels = LIQUIDITY_LABELS;

  readonly loading = signal(true);
  readonly result = signal<InvestmentComparisonResult | null>(null);

  readonly amount = signal(100000);
  readonly tenureYears = signal(1);
  readonly sortBy = signal<InvestmentComparisonFilters['sortBy']>('maturityAmount');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  readonly eligibleRows = computed(() => (this.result()?.rows ?? []).filter((r) => r.isEligible));
  readonly ineligibleRows = computed(() => (this.result()?.rows ?? []).filter((r) => !r.isEligible));

  readonly chartOptions = computed<EChartsCoreOption | null>(() => {
    const rows = this.eligibleRows();
    if (!rows.length) return null;
    const sorted = [...rows].sort((a, b) => b.maturityAmount - a.maturityAmount);
    return {
      grid: { left: 90, right: 20, top: 20, bottom: 30 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', axisLabel: { formatter: (v: number) => currency(v) } },
      yAxis: { type: 'category', data: sorted.map((r) => r.label).reverse(), axisLabel: { fontSize: 11 } },
      series: [
        {
          type: 'bar',
          data: sorted.map((r, i) => ({ value: r.maturityAmount, itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] } })).reverse(),
          barMaxWidth: 24,
        },
      ],
    };
  });

  ngOnInit(): void {
    this.load();
  }

  private currentFilters(): InvestmentComparisonFilters {
    return {
      amount: this.amount(),
      tenureYears: this.tenureYears(),
      sortBy: this.sortBy(),
      sortDir: this.sortDir(),
    };
  }

  load(): void {
    if (this.amount() <= 0 || this.tenureYears() <= 0) {
      this.toast.error('Please enter a valid amount and tenure.');
      return;
    }
    this.loading.set(true);
    this.comparisonService.compare(this.currentFilters()).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err?.error?.error?.message ?? 'Failed to compare investments.');
      },
    });
  }

  setTenure(years: number): void {
    this.tenureYears.set(years);
    this.load();
  }

  sortByColumn(column: NonNullable<InvestmentComparisonFilters['sortBy']>): void {
    if (this.sortBy() === column) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDir.set('desc');
    }
    this.load();
  }

  riskBadgeClass(risk: string): string {
    switch (risk) {
      case 'LOW':
        return 'bg-profit/15 text-profit';
      case 'LOW_MODERATE':
        return 'bg-primary/15 text-primary';
      case 'MODERATE':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
      case 'MODERATE_HIGH':
      case 'HIGH':
        return 'bg-loss/15 text-loss';
      default:
        return 'bg-black/10 dark:bg-white/10';
    }
  }

  liquidityBadgeClass(liquidity: string): string {
    switch (liquidity) {
      case 'HIGH':
        return 'bg-profit/15 text-profit';
      case 'MEDIUM':
        return 'bg-primary/15 text-primary';
      case 'LOW':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
      case 'NONE':
        return 'bg-loss/15 text-loss';
      default:
        return 'bg-black/10 dark:bg-white/10';
    }
  }

  currency(value: number): string {
    return currency(value);
  }
}
