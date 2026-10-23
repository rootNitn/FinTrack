import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { APPOINTMENT_STATUSES, DOCTOR_SPECIALTIES, DoctorAppointment } from '../health.model';
import { AppointmentsService } from '../appointments.service';

export interface AppointmentFormDialogData {
  appointment?: DoctorAppointment;
}

@Component({
  selector: 'app-appointment-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './appointment-form.component.html',
})
export class AppointmentFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly dialogRef = inject(MatDialogRef<AppointmentFormComponent>);
  readonly data = inject<AppointmentFormDialogData>(MAT_DIALOG_DATA);

  readonly statuses = APPOINTMENT_STATUSES;
  readonly specialties = DOCTOR_SPECIALTIES;
  readonly isEdit = !!this.data?.appointment;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    doctorName: [this.data?.appointment?.doctorName ?? '', [Validators.required]],
    specialty: [
      this.data?.appointment?.specialty && this.specialties.includes(this.data.appointment.specialty)
        ? this.data.appointment.specialty
        : this.data?.appointment?.specialty
          ? 'Other'
          : '',
    ],
    specialtyOther: [
      this.data?.appointment?.specialty && !this.specialties.includes(this.data.appointment.specialty)
        ? this.data.appointment.specialty
        : '',
    ],
    appointmentDate: [this.data?.appointment ? new Date(this.data.appointment.appointmentDate) : new Date(), [Validators.required]],
    appointmentTime: [this.formatTime(this.data?.appointment ? new Date(this.data.appointment.appointmentDate) : new Date()), [Validators.required]],
    location: [this.data?.appointment?.location ?? ''],
    status: [this.data?.appointment?.status ?? 'SCHEDULED', [Validators.required]],
    reminderEnabled: [this.data?.appointment?.reminderEnabled ?? true],
    notes: [this.data?.appointment?.notes ?? ''],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const appointmentDate = new Date(raw.appointmentDate as Date);
    const [hours, minutes] = raw.appointmentTime.split(':').map(Number);
    appointmentDate.setHours(hours, minutes, 0, 0);

    const payload = {
      doctorName: raw.doctorName,
      specialty: (raw.specialty === 'Other' ? raw.specialtyOther : raw.specialty) || undefined,
      appointmentDate: appointmentDate.toISOString(),
      location: raw.location || undefined,
      status: raw.status,
      reminderEnabled: raw.reminderEnabled,
      notes: raw.notes || undefined,
    };

    const request = this.isEdit
      ? this.appointmentsService.update(this.data.appointment!.id, payload)
      : this.appointmentsService.create(payload);

    request.subscribe({
      next: (appointment) => {
        this.submitting.set(false);
        this.dialogRef.close(appointment);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save appointment.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  private formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}
