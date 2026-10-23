import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { Medication } from '../health.model';
import { MedicationsService } from '../medications.service';
import { MedicationFormComponent } from '../medication-form/medication-form.component';

@Component({
  selector: 'app-medication-list',
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatTooltipModule, MatChipsModule, PageHeaderComponent, DataTableComponent],
  templateUrl: './medication-list.component.html',
})
export class MedicationListComponent {
  private readonly medicationsService = inject(MedicationsService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly medications = signal<Medication[]>([]);

  readonly columns: DataTableColumn<Medication>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'dosage', header: 'Dosage', cell: (row) => row.dosage ?? '-' },
    { key: 'scheduleTimes', header: 'Schedule', cell: (row) => (row.scheduleTimes.length ? row.scheduleTimes.join(', ') : '-') },
    { key: 'active', header: 'Active', cell: (row) => (row.active ? 'Yes' : 'No') },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.medicationsService.list().subscribe({
      next: (medications) => {
        this.medications.set(medications);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  markTaken(medication: Medication): void {
    this.medicationsService.logDose(medication.id, 'TAKEN', new Date().toISOString()).subscribe({
      next: () => this.toast.success(`Marked ${medication.name} as taken.`),
      error: () => this.toast.error('Failed to log dose.'),
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(MedicationFormComponent, { width: '560px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Medication added.');
        this.load();
      }
    });
  }

  openEditDialog(medication: Medication): void {
    const ref = this.dialog.open(MedicationFormComponent, { width: '560px', data: { medication } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Medication updated.');
        this.load();
      }
    });
  }

  remove(medication: Medication): void {
    this.confirmDialog
      .open({ title: 'Delete medication', message: `Delete ${medication.name}? This cannot be undone.`, confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.medicationsService.remove(medication.id).subscribe(() => {
          this.toast.success('Medication deleted.');
          this.load();
        });
      });
  }
}
