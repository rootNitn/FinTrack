import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { EChartsCoreOption } from 'echarts/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { CHART_PALETTE, gradientFill } from '../../../shared/charts/chart-style.util';
import { ToastService } from '../../../core/services/toast.service';
import { HealthSummaryService } from '../health-summary.service';
import { DailyLogService } from '../daily-log.service';
import { HealthSummary } from '../health.model';
import { formatDate } from '../../../shared/utils/date.util';
import { HealthConnectionComponent } from '../health-connection/health-connection.component';

@Component({
  selector: 'app-health-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    PageHeaderComponent,
    SkeletonLoaderComponent,
    ChartCardComponent,
    KpiCardComponent,
    HealthConnectionComponent,
  ],
  templateUrl: './health-dashboard.component.html',
  styleUrl: './health-dashboard.component.scss',
})
export class HealthDashboardComponent implements OnInit {
  private readonly summaryService = inject(HealthSummaryService);
  private readonly dailyLogService = inject(DailyLogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly isNative = Capacitor.isNativePlatform();
  readonly summary = signal<HealthSummary | null>(null);
  readonly savingDailyLog = signal(false);

  readonly waterIntakeMl = signal<number | null>(null);
  readonly sleepHours = signal<number | null>(null);
  readonly steps = signal<number | null>(null);

  readonly weightTrendOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.summary()?.weightTrend;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: data.map((d) => formatDate(d.recordedAt)) },
      yAxis: { type: 'value', axisLabel: { formatter: '{value} kg' } },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 3, color: CHART_PALETTE[0] },
          areaStyle: { color: gradientFill(CHART_PALETTE[0]) },
          data: data.map((d) => d.weightKg),
        },
      ],
    };
  });

  readonly bloodPressureTrendOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.summary()?.vitalsTrend?.BLOOD_PRESSURE;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'axis' },
      legend: { top: 0, data: ['Systolic', 'Diastolic'] },
      grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: data.map((d) => formatDate(d.recordedAt)) },
      yAxis: { type: 'value' },
      series: [
        { name: 'Systolic', type: 'line', smooth: true, data: data.map((d) => d.systolic), itemStyle: { color: CHART_PALETTE[6] } },
        { name: 'Diastolic', type: 'line', smooth: true, data: data.map((d) => d.diastolic), itemStyle: { color: CHART_PALETTE[4] } },
      ],
    };
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.summaryService.get().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.waterIntakeMl.set(summary.today?.waterIntakeMl ?? null);
        this.sleepHours.set(summary.today?.sleepHours ?? null);
        this.steps.set(summary.today?.steps ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  saveDailyLog(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.savingDailyLog.set(true);
    this.dailyLogService
      .upsert(today, {
        waterIntakeMl: this.waterIntakeMl() ?? undefined,
        sleepHours: this.sleepHours() ?? undefined,
        steps: this.steps() ?? undefined,
      })
      .subscribe({
        next: () => {
          this.savingDailyLog.set(false);
          this.toast.success("Today's wellness log saved.");
          this.load();
        },
        error: () => {
          this.savingDailyLog.set(false);
          this.toast.error('Failed to save daily log.');
        },
      });
  }
}
