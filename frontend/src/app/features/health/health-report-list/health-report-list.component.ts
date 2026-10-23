import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { HealthReportDocument } from '../health.model';
import { HealthReportsService } from '../health-reports.service';
import { HealthReportUploadFormComponent } from '../health-report-upload-form/health-report-upload-form.component';
import { formatDate } from '../../../shared/utils/date.util';

@Component({
  selector: 'app-health-report-list',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    PageHeaderComponent,
    DataTableComponent,
  ],
  templateUrl: './health-report-list.component.html',
})
export class HealthReportListComponent {
  private readonly healthReportsService = inject(HealthReportsService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly reports = signal<HealthReportDocument[]>([]);

  readonly columns: DataTableColumn<HealthReportDocument>[] = [
    { key: 'reportDate', header: 'Report Date', sortable: true, cell: (row) => formatDate(row.reportDate) },
    { key: 'testDate', header: 'Test Date', sortable: true, cell: (row) => (row.testDate ? formatDate(row.testDate) : '-') },
    { key: 'fileName', header: 'File', cell: (row) => row.fileName },
    { key: 'labName', header: 'Lab', cell: (row) => row.labName ?? '-' },
    { key: 'status', header: 'Status', sortable: true },
    { key: 'resultCount', header: 'Results', cell: (row) => String(row.resultCount ?? 0) },
    {
      key: 'abnormalCount',
      header: 'Out of Range',
      cell: (row) => (row.abnormalCount ? `${row.abnormalCount} abnormal` : 'All normal'),
    },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.healthReportsService.list().subscribe({
      next: (reports) => {
        this.reports.set(reports);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openReport(report: HealthReportDocument): void {
    this.router.navigate(['/health/reports', report.id]);
  }

  openUploadDialog(): void {
    const ref = this.dialog.open(HealthReportUploadFormComponent, { width: '560px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Report uploaded and parsed.');
        this.load();
      }
    });
  }

  remove(report: HealthReportDocument): void {
    this.confirmDialog
      .open({ title: 'Delete report', message: `Delete "${report.fileName}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.healthReportsService.remove(report.id).subscribe(() => {
          this.toast.success('Report deleted.');
          this.load();
        });
      });
  }
}
