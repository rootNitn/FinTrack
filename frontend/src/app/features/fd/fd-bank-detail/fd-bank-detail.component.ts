import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import type { EChartsCoreOption } from 'echarts/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { CHART_PALETTE, gradientFill } from '../../../shared/charts/chart-style.util';
import { ToastService } from '../../../core/services/toast.service';
import { FdBanksService } from '../fd-banks.service';
import { FdRateHistoryService } from '../fd-rate-history.service';
import { FdFavoritesService } from '../fd-favorites.service';
import { FdBank, FdTrendPrediction, RateHistoryRange, FD_BANK_TYPE_LABELS } from '../fd.model';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-fd-bank-detail',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    PageHeaderComponent,
    ChartCardComponent,
    SkeletonLoaderComponent,
  ],
  templateUrl: './fd-bank-detail.component.html',
  styleUrl: './fd-bank-detail.component.scss',
})
export class FdBankDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly banksService = inject(FdBanksService);
  private readonly historyService = inject(FdRateHistoryService);
  private readonly favoritesService = inject(FdFavoritesService);
  private readonly toast = inject(ToastService);

  readonly bankTypeLabels = FD_BANK_TYPE_LABELS;
  readonly loading = signal(true);
  readonly bank = signal<FdBank | null>(null);
  readonly isFavorite = signal(false);

  readonly selectedTenureLabel = signal('1 Year');
  readonly range = signal<RateHistoryRange>('1Y');
  readonly historyLoading = signal(true);
  readonly chartOptions = signal<EChartsCoreOption | null>(null);
  readonly trend = signal<FdTrendPrediction | null>(null);

  readonly ranges: RateHistoryRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];

  readonly bankId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');

  ngOnInit(): void {
    const id = this.bankId();
    this.banksService.getById(id).subscribe({
      next: (bank) => {
        this.bank.set(bank);
        this.loading.set(false);
        this.loadHistory();
        this.loadTrend();
      },
      error: () => this.loading.set(false),
    });

    this.favoritesService.list().subscribe((favorites) => {
      this.isFavorite.set(favorites.some((f) => f.bankId === id));
    });
  }

  loadHistory(): void {
    this.historyLoading.set(true);
    this.historyService.getHistory(this.bankId(), this.selectedTenureLabel(), this.range()).subscribe({
      next: (points) => {
        this.chartOptions.set({
          tooltip: { trigger: 'axis' },
          grid: { left: 50, right: 16, top: 24, bottom: 32 },
          xAxis: { type: 'category', data: points.map((p) => p.month) },
          yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
          series: [
            {
              name: 'Rate',
              type: 'line',
              smooth: true,
              symbol: 'circle',
              areaStyle: { color: gradientFill(CHART_PALETTE[1]) },
              itemStyle: { color: CHART_PALETTE[1] },
              data: points.map((p) => p.interestRate),
            },
          ],
        });
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  loadTrend(): void {
    this.historyService.getTrendPrediction(this.bankId(), this.selectedTenureLabel()).subscribe({
      next: (trend) => this.trend.set(trend),
      error: () => this.trend.set(null),
    });
  }

  onRangeChange(range: RateHistoryRange): void {
    this.range.set(range);
    this.loadHistory();
  }

  toggleFavorite(): void {
    const id = this.bankId();
    if (this.isFavorite()) {
      this.favoritesService.remove(id).subscribe(() => {
        this.isFavorite.set(false);
        this.toast.success('Removed from favorites.');
      });
    } else {
      this.favoritesService.add(id).subscribe(() => {
        this.isFavorite.set(true);
        this.toast.success('Added to favorites.');
      });
    }
  }

  currency(value: number): string {
    return currency(value);
  }
}
