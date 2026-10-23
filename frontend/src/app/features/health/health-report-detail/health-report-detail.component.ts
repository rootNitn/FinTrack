import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import type { EChartsCoreOption } from 'echarts/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { HealthReportDocument, HealthReportResult } from '../health.model';
import { HealthReportsService } from '../health-reports.service';
import { HealthReportResultFormComponent } from '../health-report-result-form/health-report-result-form.component';
import { HealthWellnessDraftStoreService } from '../health-wellness-plan/health-wellness-draft-store.service';
import { categorizeTestName, TEST_CATEGORY_ORDER } from './test-category.util';
import { formatDate } from '../../../shared/utils/date.util';

const HIGH_COLOR = '#ef4444';
const LOW_COLOR = '#f59e0b';
const NORMAL_COLOR = '#22c55e';

@Component({
  selector: 'app-health-report-detail',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    KpiCardComponent,
    ChartCardComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './health-report-detail.component.html',
})
export class HealthReportDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly healthReportsService = inject(HealthReportsService);
  private readonly dialog = inject(MatDialog);
  private readonly draftStore = inject(HealthWellnessDraftStoreService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  private readonly reportId = this.route.snapshot.paramMap.get('id')!;

  readonly loading = signal(true);
  readonly aiImproving = signal(false);
  readonly report = signal<HealthReportDocument | null>(null);

  readonly subtitle = computed(() => {
    const report = this.report();
    if (!report) return '';
    const parts = [`Report date: ${formatDate(report.reportDate)}`];
    if (report.testDate) parts.push(`Test date: ${formatDate(report.testDate)}`);
    if (report.labName) parts.push(report.labName);
    return parts.join(' • ');
  });

  readonly patientInfo = computed(() => {
    const report = this.report();
    if (!report) return null;
    const parts: string[] = [];
    if (report.patientName) parts.push(report.patientName);
    if (report.patientAge) parts.push(report.patientAge);
    if (report.patientGender) parts.push(report.patientGender);
    return parts.length ? parts.join(' • ') : null;
  });

  readonly results = computed(() => this.report()?.results ?? []);
  readonly abnormalCount = computed(() => this.results().filter((r) => r.flag === 'LOW' || r.flag === 'HIGH').length);
  readonly normalCount = computed(() => this.results().filter((r) => r.flag === 'NORMAL').length);

  readonly resultsByCategory = computed(() => {
    const groups = new Map<string, HealthReportResult[]>();
    for (const result of this.results()) {
      const category = categorizeTestName(result.testName);
      groups.set(category, [...(groups.get(category) ?? []), result]);
    }
    return TEST_CATEGORY_ORDER.map((category) => ({ category, results: groups.get(category) ?? [] })).filter(
      (group) => group.results.length > 0
    );
  });

  /** Plots any result with at least one reference bound — an upper-bound-only range (e.g. "<200")
   *  is common for tests like Cholesterol/AST/ALT and must still show up, not just full low+high ranges. */
  readonly chartableResults = computed(() => {
    const abnormalFirst = (flag: string) => (flag === 'HIGH' || flag === 'LOW' ? 0 : 1);
    return this.results()
      .filter((r) => r.referenceHigh != null || r.referenceLow != null)
      .map((r) => {
        // No lower bound (upper-bound-only range): assume 0 as the floor. No upper bound
        // (lower-bound-only range, e.g. "GFR >59"): use 2x the lower bound as a display ceiling.
        const low = r.referenceLow ?? 0;
        const high = r.referenceHigh ?? low * 2;
        return { ...r, percentOfRange: ((r.value - low) / (high - low)) * 100 };
      })
      .filter((r) => Number.isFinite(r.percentOfRange))
      .sort((a, b) => abnormalFirst(a.flag) - abnormalFirst(b.flag) || a.testName.localeCompare(b.testName));
  });

  readonly chartHeight = computed(() => `${Math.max(280, this.chartableResults().length * 26 + 60)}px`);

  readonly rangeChartOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.chartableResults();
    if (!data.length) return null;
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const p = (params as { dataIndex: number }[])[0];
          const r = data[p.dataIndex];
          const rangeLabel =
            r.referenceLow != null && r.referenceHigh != null
              ? `${r.referenceLow} - ${r.referenceHigh}`
              : r.referenceHigh != null
                ? `< ${r.referenceHigh}`
                : `> ${r.referenceLow}`;
          return `${r.testName}: ${r.value}${r.unit ? ' ' + r.unit : ''}<br/>Reference: ${rangeLabel}`;
        },
      },
      grid: { left: 160, right: 24, top: 8, bottom: 24, containLabel: true },
      xAxis: { type: 'value', name: '% of reference range', axisLabel: { formatter: '{value}%' } },
      yAxis: { type: 'category', data: data.map((r) => r.testName), axisLabel: { fontSize: 11 } },
      series: [
        {
          type: 'bar',
          data: data.map((r) => ({
            value: Number(r.percentOfRange.toFixed(1)),
            itemStyle: { color: r.flag === 'HIGH' ? HIGH_COLOR : r.flag === 'LOW' ? LOW_COLOR : NORMAL_COLOR },
          })),
          barMaxWidth: 16,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#94a3b8', type: 'dashed' },
            data: [{ xAxis: 0 }, { xAxis: 100 }],
            label: { show: false },
          },
        },
      ],
    };
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.healthReportsService.getById(this.reportId).subscribe({
      next: (report) => {
        this.report.set(report);
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

  openAddResultDialog(): void {
    const ref = this.dialog.open(HealthReportResultFormComponent, { width: '520px', data: { reportId: this.reportId } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Result added.');
        this.load();
      }
    });
  }

  openEditResultDialog(result: HealthReportResult): void {
    const ref = this.dialog.open(HealthReportResultFormComponent, { width: '520px', data: { reportId: this.reportId, result } });
    ref.afterClosed().subscribe((updated) => {
      if (updated) {
        this.toast.success('Result updated.');
        this.load();
      }
    });
  }

  removeResult(result: HealthReportResult): void {
    this.confirmDialog
      .open({ title: 'Delete result', message: `Delete "${result.testName}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.healthReportsService.removeResult(this.reportId, result.id).subscribe(() => {
          this.toast.success('Result deleted.');
          this.load();
        });
      });
  }

  compareTest(testName: string): void {
    this.router.navigate(['/health/reports/compare'], { queryParams: { testName } });
  }

  improveWithAi(): void {
    const report = this.report();
    if (!report) return;

    this.aiImproving.set(true);
    this.healthReportsService.getWellnessPlanForReport(report.id).subscribe({
      next: (existingPlan) => {
        this.aiImproving.set(false);
        if (existingPlan) {
          // Already generated & saved for this report — show it instead of calling the AI again.
          this.router.navigate(['/health/wellness-plan', existingPlan.id]);
          return;
        }
        this.generateWellnessPlan(report.id);
      },
      error: () => this.generateWellnessPlan(report.id),
    });
  }

  private generateWellnessPlan(reportId: string): void {
    const request = { reportId };
    this.aiImproving.set(true);
    this.healthReportsService.improveWithAi(request).subscribe({
      next: (improvements) => {
        this.aiImproving.set(false);
        this.draftStore.set(improvements, request);
        this.router.navigate(['/health/wellness-plan', 'new']);
      },
      error: () => {
        this.aiImproving.set(false);
        this.toast.error('Failed to generate health improvement recommendations. Please try again.');
      },
    });
  }

  deleteReport(): void {
    const report = this.report();
    if (!report) return;
    this.confirmDialog
      .open({ title: 'Delete report', message: `Delete "${report.fileName}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.healthReportsService.remove(report.id).subscribe(() => {
          this.toast.success('Report deleted.');
          this.router.navigate(['/health/reports']);
        });
      });
  }
}
