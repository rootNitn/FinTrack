import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { BodyMetricLog } from '../health.model';
import { BodyMetricsService } from '../body-metrics.service';
import { BodyMetricFormComponent } from '../body-metric-form/body-metric-form.component';
import { formatDate } from '../../../shared/utils/date.util';

@Component({
  selector: 'app-body-metric-list',
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatTooltipModule, PageHeaderComponent, DataTableComponent],
  templateUrl: './body-metric-list.component.html',
})
export class BodyMetricListComponent {
  private readonly bodyMetricsService = inject(BodyMetricsService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly logs = signal<BodyMetricLog[]>([]);

  readonly columns: DataTableColumn<BodyMetricLog>[] = [
    { key: 'recordedAt', header: 'Date', sortable: true, cell: (row) => formatDate(row.recordedAt) },
    { key: 'weightKg', header: 'Weight (kg)', sortable: true, cell: (row) => String(row.weightKg) },
    { key: 'bmi', header: 'BMI', cell: (row) => (row.bmi != null ? String(row.bmi) : '-') },
    { key: 'bodyFatPercent', header: 'Body Fat %', cell: (row) => (row.bodyFatPercent != null ? String(row.bodyFatPercent) : '-') },
    { key: 'waistCm', header: 'Waist (cm)', cell: (row) => (row.waistCm != null ? String(row.waistCm) : '-') },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.bodyMetricsService.list().subscribe({
      next: (logs) => {
        this.logs.set(logs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(BodyMetricFormComponent, { width: '560px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Body metric log added.');
        this.load();
      }
    });
  }

  openEditDialog(log: BodyMetricLog): void {
    const ref = this.dialog.open(BodyMetricFormComponent, { width: '560px', data: { log } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Body metric log updated.');
        this.load();
      }
    });
  }

  remove(log: BodyMetricLog): void {
    this.confirmDialog
      .open({ title: 'Delete log', message: 'Delete this body metric log? This cannot be undone.', confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.bodyMetricsService.remove(log.id).subscribe(() => {
          this.toast.success('Log deleted.');
          this.load();
        });
      });
  }
}
