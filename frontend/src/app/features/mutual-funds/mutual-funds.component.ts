import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { EChartsCoreOption } from 'echarts/core';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card.component';
import { CHART_PALETTE } from '../../shared/charts/chart-style.util';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../shared/utils/currency.util';
import { formatPercent as formatPercentShared } from '../../shared/utils/percent.util';
import { InvestmentsService } from '../investments/investments.service';
import { MutualFundsService } from './mutual-funds.service';
import {
  MUTUAL_FUND_RATING_CLASSES,
  MUTUAL_FUND_RATING_LABELS,
  MutualFundDashboard,
  MutualFundHolding,
  MutualFundRating,
  MutualFundSortKey,
} from './mutual-funds.model';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-mutual-funds',
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    PageHeaderComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
    ChartCardComponent,
  ],
  templateUrl: './mutual-funds.component.html',
  styleUrl: './mutual-funds.component.scss',
})
export class MutualFundsComponent implements OnInit {
  private readonly mutualFundsService = inject(MutualFundsService);
  private readonly investmentsService = inject(InvestmentsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly dashboard = signal<MutualFundDashboard | null>(null);

  readonly ratingFilter = signal<MutualFundRating | 'ALL'>('ALL');
  readonly categoryFilter = signal<string>('ALL');
  readonly searchTerm = signal<string>('');
  readonly sortKey = signal<MutualFundSortKey>('currentValue');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  readonly ratingLabels = MUTUAL_FUND_RATING_LABELS;
  readonly ratingClasses = MUTUAL_FUND_RATING_CLASSES;

  readonly categoryOptions = computed(() => {
    const funds = this.dashboard()?.funds ?? [];
    return Array.from(new Set(funds.map((f) => f.categoryLabel))).sort();
  });

  readonly filteredFunds = computed<MutualFundHolding[]>(() => {
    const funds = this.dashboard()?.funds ?? [];
    const rating = this.ratingFilter();
    const category = this.categoryFilter();
    const search = this.searchTerm().trim().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;

    const filtered = funds.filter((f) => {
      if (rating !== 'ALL' && f.rating !== rating) return false;
      if (category !== 'ALL' && f.categoryLabel !== category) return false;
      if (search && !f.name.toLowerCase().includes(search)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  });

  readonly allocationOptions = computed<EChartsCoreOption | null>(() => {
    const allocation = this.dashboard()?.allocation ?? [];
    if (!allocation.length) return null;
    return {
      tooltip: { trigger: 'item', formatter: (p: { name: string; value: number; percent: number }) => `${p.name}: ${currency(p.value)} (${p.percent}%)` },
      legend: { bottom: 0, left: 'center' },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { formatter: '{b}\n{d}%' },
          data: allocation.map((slice, i) => ({ name: slice.label, value: slice.value, itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] } })),
        },
      ],
    };
  });

  readonly termBreakdown = computed(() => this.dashboard()?.termBreakdown ?? []);
  readonly categoryBreakdown = computed(() => this.dashboard()?.categoryBreakdown ?? []);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.mutualFundsService.getDashboard().subscribe({
      next: (result) => {
        this.dashboard.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load Mutual Funds dashboard.');
      },
    });
  }

  refreshPrices(): void {
    this.refreshing.set(true);
    this.investmentsService.refreshPrices().subscribe({
      next: (result) => {
        this.refreshing.set(false);
        this.toast.success(`Refreshed ${result.updated} of ${result.total} holdings.`);
        this.load();
      },
      error: () => {
        this.refreshing.set(false);
        this.toast.error('Failed to refresh prices.');
      },
    });
  }

  setSort(key: MutualFundSortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('desc');
    }
  }

  currency(value: number): string {
    return currency(value);
  }

  formatPercent(value: number | null): string {
    return formatPercentShared(value, { signed: true });
  }

  detailLink(fund: MutualFundHolding): string[] {
    // Angular Router already URL-encodes route segments — don't pre-encode `fund.key` here
    // (that would double-encode it, e.g. ":" -> "%3A" -> "%253A").
    return ['/mutual-funds', fund.key];
  }
}
