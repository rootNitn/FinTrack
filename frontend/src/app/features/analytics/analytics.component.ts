import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import type { EChartsCoreOption } from 'echarts/core';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card.component';
import { CHART_PALETTE, gradientFill } from '../../shared/charts/chart-style.util';
import { ToastService } from '../../core/services/toast.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsResult } from './analytics.model';
import { formatCurrency } from '../../shared/utils/currency.util';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ListFilterBarComponent } from '../../shared/components/list-filter-bar/list-filter-bar.component';
import { downloadBlob } from '../../shared/utils/file-download.util';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-analytics',
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, PageHeaderComponent, SkeletonLoaderComponent, ChartCardComponent, EmptyStateComponent, ListFilterBarComponent],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
})
export class AnalyticsComponent implements OnInit {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly result = signal<AnalyticsResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly exportingExcel = signal(false);
  readonly exportingPdf = signal(false);
  readonly activeFilterCount = computed(() => Number(!!this.startDate()) + Number(!!this.endDate()));

  startTracking(): void {
    this.router.navigate(['/transactions']);
  }

  clearFilters(): void {
    this.startDate.set('');
    this.endDate.set('');
    this.load();
  }

  readonly incomeVsExpenseOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.result()?.incomeVsExpense;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => currency(v as number) },
      legend: { top: 0, data: ['Income', 'Expense', 'Savings'] },
      grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: data.map((d) => d.label) },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => currency(v) } },
      series: [
        { name: 'Income', type: 'bar', data: data.map((d) => d.income), itemStyle: { color: CHART_PALETTE[1], borderRadius: [4, 4, 0, 0] }, barMaxWidth: 20 },
        { name: 'Expense', type: 'bar', data: data.map((d) => d.expense), itemStyle: { color: CHART_PALETTE[6], borderRadius: [4, 4, 0, 0] }, barMaxWidth: 20 },
        { name: 'Savings', type: 'line', smooth: true, data: data.map((d) => d.savings), itemStyle: { color: CHART_PALETTE[0] } },
      ],
    };
  });

  readonly expenseHeatmapOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.result()?.expenseHeatmap;
    if (!data?.length) return null;
    const values = data.map((d) => d.value);
    const max = Math.max(...values, 1);
    return {
      tooltip: { formatter: (p: { data: [string, number] }) => `${p.data[0]}: ${currency(p.data[1])}` },
      visualMap: {
        min: 0,
        max,
        type: 'piecewise',
        orient: 'horizontal',
        left: 'center',
        top: 0,
        pieces: [
          { min: 0, max: 0, color: '#e5e7eb' },
          { min: 0.01, max: max * 0.25, color: '#c7d2fe' },
          { min: max * 0.25, max: max * 0.5, color: '#818cf8' },
          { min: max * 0.5, max: max * 0.75, color: '#6366f1' },
          { min: max * 0.75, max, color: '#4338ca' },
        ],
      },
      calendar: {
        top: 50,
        left: 30,
        right: 10,
        cellSize: ['auto', 14],
        range: [data[0].date, data[data.length - 1].date],
        itemStyle: { borderWidth: 2, borderColor: 'transparent' },
        yearLabel: { show: false },
        dayLabel: { fontSize: 10 },
        monthLabel: { fontSize: 10 },
      },
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data: data.map((d) => [d.date, d.value]),
        },
      ],
    };
  });

  readonly savingsRateOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.result()?.monthlySavingsRate;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => `${v}%` },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: data.map((d) => d.label) },
      yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 3, color: CHART_PALETTE[1] },
          areaStyle: { color: gradientFill(CHART_PALETTE[1]) },
          data: data.map((d) => d.savingsRate),
        },
      ],
    };
  });

  readonly netWorthGrowthOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.result()?.netWorthGrowth;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => currency(v as number) },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: data.map((d) => d.label) },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => currency(v) } },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 3, color: CHART_PALETTE[0] },
          areaStyle: { color: gradientFill(CHART_PALETTE[0]) },
          data: data.map((d) => d.netWorth),
        },
      ],
    };
  });

  readonly investmentTrendOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.result()?.investmentPerformance.trend;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => currency(v as number) },
      legend: { top: 0, data: ['Principal Amount', 'Current Value'] },
      grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: data.map((d) => d.label) },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => currency(v) } },
      series: [
        {
          name: 'Principal Amount',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 3, color: CHART_PALETTE[0] },
          data: data.map((d) => d.principalAmount),
        },
        {
          name: 'Current Value',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 3, color: CHART_PALETTE[5] },
          areaStyle: { color: gradientFill(CHART_PALETTE[5]) },
          data: data.map((d) => d.investmentValue),
        },
      ],
    };
  });

  readonly categoryPerformanceOptions = computed<EChartsCoreOption | null>(() => {
    const rows = this.result()?.investmentPerformance.categoryPerformance;
    if (!rows?.length) return null;
    const sorted = [...rows].reverse();
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: unknown) => currency(v as number) },
      grid: { left: 100, right: 20, top: 16, bottom: 16 },
      xAxis: { type: 'value', axisLabel: { formatter: (v: number) => currency(v) } },
      yAxis: { type: 'category', data: sorted.map((r) => r.category), axisLabel: { fontSize: 11 } },
      series: [
        {
          type: 'bar',
          data: sorted.map((r) => r.profit),
          itemStyle: {
            color: (params: { value: number }) => (params.value >= 0 ? CHART_PALETTE[1] : CHART_PALETTE[6]),
            borderRadius: [0, 6, 6, 0],
          },
          barMaxWidth: 18,
        },
      ],
    };
  });

  readonly categorySpendingOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.result()?.categorySpending;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'item', formatter: (p: { name: string; value: number; percent: number }) => `${p.name}: ${currency(p.value)} (${p.percent}%)` },
      legend: { orient: 'vertical', left: 0, top: 'middle', textStyle: { fontSize: 11 } },
      series: [
        {
          type: 'pie',
          radius: ['45%', '75%'],
          center: ['65%', '50%'],
          data: data.map((d, i) => ({ name: d.category, value: d.amount, itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] } })),
          label: { show: false },
        },
      ],
    };
  });

  readonly yearOverYearOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.result()?.yearOverYear;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => currency(v as number) },
      legend: { top: 0, data: ['Income', 'Expense', 'Net Worth'] },
      grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: data.map((d) => String(d.year)) },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => currency(v) } },
      series: [
        { name: 'Income', type: 'bar', data: data.map((d) => d.income), itemStyle: { color: CHART_PALETTE[1], borderRadius: [4, 4, 0, 0] }, barMaxWidth: 32 },
        { name: 'Expense', type: 'bar', data: data.map((d) => d.expense), itemStyle: { color: CHART_PALETTE[6], borderRadius: [4, 4, 0, 0] }, barMaxWidth: 32 },
        { name: 'Net Worth', type: 'line', smooth: true, data: data.map((d) => d.netWorth), itemStyle: { color: CHART_PALETTE[0] } },
      ],
    };
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.analyticsService.getAnalytics(this.startDate() || undefined, this.endDate() || undefined).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Failed to load analytics.');
        this.toast.error(err?.error?.error?.message ?? 'Failed to load analytics.');
      },
    });
  }

  applyDateRange(): void {
    this.load();
  }

  exportCsv(): void {
    const data = this.result();
    if (!data) return;
    const rows: string[][] = [['Chart', 'Label', 'Metric', 'Value']];
    data.incomeVsExpense.forEach((point) => {
      rows.push(['Income vs Expense', point.label, 'Income', String(point.income)]);
      rows.push(['Income vs Expense', point.label, 'Expense', String(point.expense)]);
      rows.push(['Income vs Expense', point.label, 'Savings', String(point.savings)]);
    });
    data.monthlySavingsRate.forEach((point) => rows.push(['Monthly Savings Rate', point.label, 'Savings rate', String(point.savingsRate)]));
    data.categorySpending.forEach((point) => rows.push(['Category Spending', point.category, 'Amount', String(point.amount)]));
    data.investmentPerformance.categoryPerformance.forEach((point) => rows.push(['Profit by Category', point.category, 'Profit', String(point.profit)]));
    data.yearOverYear.forEach((point) => rows.push(['YoY Growth', String(point.year), 'Savings', String(point.savings)]));
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  exportExcel(): void {
    this.exportingExcel.set(true);
    this.analyticsService.exportExcel(this.startDate() || undefined, this.endDate() || undefined).subscribe({
      next: (blob) => {
        downloadBlob(blob, 'analytics.xlsx');
        this.exportingExcel.set(false);
      },
      error: () => {
        this.exportingExcel.set(false);
        this.toast.error('Failed to export analytics to Excel.');
      },
    });
  }

  exportPdf(): void {
    this.exportingPdf.set(true);
    this.analyticsService.exportPdf(this.startDate() || undefined, this.endDate() || undefined).subscribe({
      next: (blob) => {
        downloadBlob(blob, 'analytics.pdf');
        this.exportingPdf.set(false);
      },
      error: () => {
        this.exportingPdf.set(false);
        this.toast.error('Failed to export analytics to PDF.');
      },
    });
  }

  hasData(): boolean {
    const data = this.result();
    return !!data && (data.incomeVsExpense.length > 0 || data.expenseHeatmap.length > 0 || data.netWorthGrowth.length > 0 || data.categorySpending.length > 0 || data.yearOverYear.length > 0 || data.investmentPerformance.categoryPerformance.length > 0);
  }

  onChartClick(event: unknown): void {
    if (!event || typeof event !== 'object') return;
    const params = event as { name?: string; seriesName?: string };
    if (params.seriesName === 'Profit by Category' && params.name) {
      this.router.navigate(['/investments'], { queryParams: { category: params.name } });
    } else if (params.name && params.seriesName === undefined) {
      this.router.navigate(['/expenses'], { queryParams: { category: params.name } });
    }
  }

  currency(value: number): string {
    return currency(value);
  }

  growthClass(value: number | null): string {
    if (value === null) return 'text-black/40 dark:text-white/40';
    return value >= 0 ? 'text-profit' : 'text-loss';
  }

  growthLabel(value: number | null): string {
    if (value === null) return '—';
    return `${value >= 0 ? '▲' : '▼'} ${Math.abs(value)}%`;
  }
}
