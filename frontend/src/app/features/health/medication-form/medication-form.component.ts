import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Medication } from '../health.model';
import { MedicationsService } from '../medications.service';

export interface MedicationFormDialogData {
  medication?: Medication;
}

@Component({
  selector: 'app-medication-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './medication-form.component.html',
})
export class MedicationFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly medicationsService = inject(MedicationsService);
  private readonly dialogRef = inject(MatDialogRef<MedicationFormComponent>);
  readonly data = inject<MedicationFormDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data?.medication;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly scheduleTimes = signal<string[]>(this.data?.medication?.scheduleTimes ?? []);
  readonly newTime = signal('');

  readonly form = this.fb.nonNullable.group({
    name: [this.data?.medication?.name ?? '', [Validators.required]],
    dosage: [this.data?.medication?.dosage ?? ''],
    startDate: [this.data?.medication ? new Date(this.data.medication.startDate) : new Date(), [Validators.required]],
    endDate: [this.data?.medication?.endDate ? new Date(this.data.medication.endDate) : null],
    active: [this.data?.medication?.active ?? true],
    reminderEnabled: [this.data?.medication?.reminderEnabled ?? true],
    notes: [this.data?.medication?.notes ?? ''],
  });

  addTime(): void {
    const time = this.newTime().trim();
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) return;
    if (!this.scheduleTimes().includes(time)) {
      this.scheduleTimes.set([...this.scheduleTimes(), time].sort());
    }
    this.newTime.set('');
  }

  removeTime(time: string): void {
    this.scheduleTimes.set(this.scheduleTimes().filter((t) => t !== time));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name,
      dosage: raw.dosage || undefined,
      scheduleTimes: this.scheduleTimes(),
      startDate: (raw.startDate as Date).toISOString(),
      endDate: raw.endDate ? (raw.endDate as Date).toISOString() : null,
      active: raw.active,
      reminderEnabled: raw.reminderEnabled,
      notes: raw.notes || undefined,
    };

    const request = this.isEdit
      ? this.medicationsService.update(this.data.medication!.id, payload)
      : this.medicationsService.create(payload);

    request.subscribe({
      next: (medication) => {
        this.submitting.set(false);
        this.dialogRef.close(medication);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save medication.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
