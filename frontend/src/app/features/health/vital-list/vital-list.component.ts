import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { VITAL_TYPES, VitalLog, VitalType } from '../health.model';
import { VitalsService } from '../vitals.service';
import { VitalFormComponent } from '../vital-form/vital-form.component';
import { formatDate } from '../../../shared/utils/date.util';

@Component({
  selector: 'app-vital-list',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    PageHeaderComponent,
    DataTableComponent,
  ],
  templateUrl: './vital-list.component.html',
})
export class VitalListComponent {
  private readonly vitalsService = inject(VitalsService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly vitalTypes = VITAL_TYPES;
  readonly loading = signal(true);
  readonly logs = signal<VitalLog[]>([]);
  readonly typeFilter = signal<VitalType | ''>('');

  readonly columns: DataTableColumn<VitalLog>[] = [
    { key: 'recordedAt', header: 'Date', sortable: true, cell: (row) => formatDate(row.recordedAt) },
    { key: 'type', header: 'Type', sortable: true, cell: (row) => row.type.replaceAll('_', ' ') },
    {
      key: 'reading',
      header: 'Reading',
      cell: (row) => (row.type === 'BLOOD_PRESSURE' ? `${row.systolic}/${row.diastolic} mmHg` : `${row.value} ${row.unit ?? ''}`),
    },
    { key: 'context', header: 'Context', cell: (row) => row.context ?? '-' },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.vitalsService.list(this.typeFilter() || undefined).subscribe({
      next: (logs) => {
        this.logs.set(logs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFilterChange(): void {
    this.load();
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(VitalFormComponent, { width: '560px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Vital log added.');
        this.load();
      }
    });
  }

  openEditDialog(log: VitalLog): void {
    const ref = this.dialog.open(VitalFormComponent, { width: '560px', data: { log } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Vital log updated.');
        this.load();
      }
    });
  }

  remove(log: VitalLog): void {
    this.confirmDialog
      .open({ title: 'Delete log', message: 'Delete this vital log? This cannot be undone.', confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.vitalsService.remove(log.id).subscribe(() => {
          this.toast.success('Log deleted.');
          this.load();
        });
      });
  }
}
