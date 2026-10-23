import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import type { EChartsCoreOption } from 'echarts/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { CHART_PALETTE, gradientFill } from '../../../shared/charts/chart-style.util';
import { HealthReportComparison } from '../health.model';
import { HealthReportsService } from '../health-reports.service';
import { formatDate } from '../../../shared/utils/date.util';

@Component({
  selector: 'app-health-report-compare',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    PageHeaderComponent,
    KpiCardComponent,
    ChartCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './health-report-compare.component.html',
})
export class HealthReportCompareComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly healthReportsService = inject(HealthReportsService);

  readonly testNames = signal<string[]>([]);
  readonly selectedTestName = signal<string>('');
  readonly loading = signal(false);
  readonly comparison = signal<HealthReportComparison | null>(null);

  readonly trendOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.comparison()?.history;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: data.map((d) => formatDate(d.reportDate)) },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 3, color: CHART_PALETTE[0] },
          areaStyle: { color: gradientFill(CHART_PALETTE[0]) },
          data: data.map((d) => d.value),
        },
      ],
    };
  });

  constructor() {
    this.healthReportsService.listTestNames().subscribe((names) => this.testNames.set(names));

    const initialTestName = this.route.snapshot.queryParamMap.get('testName');
    if (initialTestName) {
      this.selectedTestName.set(initialTestName);
      this.loadComparison(initialTestName);
    }
  }

  onTestNameChange(testName: string): void {
    this.selectedTestName.set(testName);
    this.loadComparison(testName);
  }

  private loadComparison(testName: string): void {
    if (!testName) return;
    this.loading.set(true);
    this.healthReportsService.compare(testName).subscribe({
      next: (comparison) => {
        this.comparison.set(comparison);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  flagBadgeClass(flag: string): string {
    if (flag === 'HIGH') return 'bg-loss/10 text-loss';
    if (flag === 'LOW') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    if (flag === 'NORMAL') return 'bg-gain/10 text-gain';
    return 'bg-black/5 text-black/40 dark:bg-white/10 dark:text-white/40';
  }
}
