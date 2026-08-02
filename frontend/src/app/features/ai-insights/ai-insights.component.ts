import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { EChartsCoreOption } from 'echarts/core';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card.component';
import { CHART_PALETTE } from '../../shared/charts/chart-style.util';
import { ToastService } from '../../core/services/toast.service';
import { AiInsightsService } from './ai-insights.service';
import { AiInsightsResult, GOAL_STATUS_BADGE_CLASSES, GOAL_STATUS_LABELS, SEVERITY_BADGE_CLASSES } from './ai-insights.model';
import { formatCurrency } from '../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-ai-insights',
  imports: [CommonModule, RouterLink, MatIconModule, MatTooltipModule, PageHeaderComponent, SkeletonLoaderComponent, ChartCardComponent],
  templateUrl: './ai-insights.component.html',
  styleUrl: './ai-insights.component.scss',
})
export class AiInsightsComponent implements OnInit {
  private readonly insightsService = inject(AiInsightsService);
  private readonly toast = inject(ToastService);

  readonly goalStatusLabels = GOAL_STATUS_LABELS;
  readonly goalStatusBadgeClasses = GOAL_STATUS_BADGE_CLASSES;
  readonly severityBadgeClasses = SEVERITY_BADGE_CLASSES;

  readonly loading = signal(true);
  readonly result = signal<AiInsightsResult | null>(null);

  readonly spendingChartOptions = computed<EChartsCoreOption | null>(() => {
    const res = this.result();
    if (!res || !res.spendingAnalysis.topCategories.length) return null;
    const rows = [...res.spendingAnalysis.topCategories].reverse();
    return {
      grid: { left: 90, right: 20, top: 20, bottom: 30 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, data: ['This Month', 'Last Month'] },
      xAxis: { type: 'value', axisLabel: { formatter: (v: number) => currency(v) } },
      yAxis: { type: 'category', data: rows.map((r) => r.category), axisLabel: { fontSize: 11 } },
      series: [
        { name: 'This Month', type: 'bar', data: rows.map((r) => r.currentMonthAmount), itemStyle: { color: CHART_PALETTE[0] }, barMaxWidth: 16 },
        { name: 'Last Month', type: 'bar', data: rows.map((r) => r.previousMonthAmount), itemStyle: { color: CHART_PALETTE[1] }, barMaxWidth: 16 },
      ],
    };
  });

  readonly allocationChartOptions = computed<EChartsCoreOption | null>(() => {
    const res = this.result();
    const allocation = res?.investmentSuggestions.currentAllocation ?? [];
    if (!allocation.length) return null;
    return {
      tooltip: { trigger: 'item', formatter: (p: { name: string; value: number; percent: number }) => `${p.name}: ${currency(p.value)} (${p.percent}%)` },
      legend: { orient: 'vertical', left: 0, top: 'middle', textStyle: { fontSize: 11 } },
      series: [
        {
          type: 'pie',
          radius: ['45%', '75%'],
          center: ['65%', '50%'],
          data: allocation.map((a, i) => ({ name: a.category, value: a.value, itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] } })),
          label: { show: false },
        },
      ],
    };
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.insightsService.getInsights().subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err?.error?.error?.message ?? 'Failed to load AI insights.');
      },
    });
  }

  severityIcon(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'lightbulb';
    }
  }

  changeClass(value: number | null): string {
    if (value === null) return '';
    return value >= 0 ? 'text-profit' : 'text-loss';
  }

  changeArrow(value: number | null): string {
    if (value === null) return '';
    return value >= 0 ? '▲' : '▼';
  }

  riskBarClass(riskLevel: string): string {
    switch (riskLevel) {
      case 'LOW':
        return 'bg-profit';
      case 'MODERATE':
        return 'bg-amber-500';
      case 'HIGH':
        return 'bg-loss';
      default:
        return 'bg-primary';
    }
  }

  currency(value: number): string {
    return currency(value);
  }

  unbudgetedCategoriesSummary(categories: { category: string; spent: number }[]): string {
    const names = categories.slice(0, 4).map((c) => c.category);
    const extra = categories.length - names.length;
    return extra > 0 ? `${names.join(', ')} and ${extra} more` : names.join(', ');
  }
}
