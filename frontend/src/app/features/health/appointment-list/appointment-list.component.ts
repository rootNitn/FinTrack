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
import { DoctorAppointment } from '../health.model';
import { AppointmentsService } from '../appointments.service';
import { AppointmentFormComponent } from '../appointment-form/appointment-form.component';
import { formatDateTime } from '../../../shared/utils/date.util';

@Component({
  selector: 'app-appointment-list',
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatTooltipModule, PageHeaderComponent, DataTableComponent],
  templateUrl: './appointment-list.component.html',
})
export class AppointmentListComponent {
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly appointments = signal<DoctorAppointment[]>([]);

  readonly columns: DataTableColumn<DoctorAppointment>[] = [
    { key: 'appointmentDate', header: 'Date', sortable: true, cell: (row) => formatDateTime(row.appointmentDate) },
    { key: 'doctorName', header: 'Doctor', sortable: true, cell: (row) => `Dr. ${row.doctorName}` },
    { key: 'specialty', header: 'Specialty', cell: (row) => row.specialty ?? '-' },
    { key: 'location', header: 'Location', cell: (row) => row.location ?? '-' },
    { key: 'status', header: 'Status', sortable: true },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.appointmentsService.list().subscribe({
      next: (appointments) => {
        this.appointments.set(appointments);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  markCompleted(appointment: DoctorAppointment): void {
    this.appointmentsService.update(appointment.id, { status: 'COMPLETED' }).subscribe({
      next: () => {
        this.toast.success('Appointment marked completed.');
        this.load();
      },
      error: () => this.toast.error('Failed to update appointment.'),
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(AppointmentFormComponent, { width: '560px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Appointment added.');
        this.load();
      }
    });
  }

  openEditDialog(appointment: DoctorAppointment): void {
    const ref = this.dialog.open(AppointmentFormComponent, { width: '560px', data: { appointment } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Appointment updated.');
        this.load();
      }
    });
  }

  remove(appointment: DoctorAppointment): void {
    this.confirmDialog
      .open({ title: 'Delete appointment', message: 'Delete this appointment? This cannot be undone.', confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.appointmentsService.remove(appointment.id).subscribe(() => {
          this.toast.success('Appointment deleted.');
          this.load();
        });
      });
  }
}
