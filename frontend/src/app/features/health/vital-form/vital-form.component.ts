import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { VITAL_TYPES, VitalLog } from '../health.model';
import { VitalsService } from '../vitals.service';

export interface VitalFormDialogData {
  log?: VitalLog;
}

@Component({
  selector: 'app-vital-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './vital-form.component.html',
})
export class VitalFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly vitalsService = inject(VitalsService);
  private readonly dialogRef = inject(MatDialogRef<VitalFormComponent>);
  readonly data = inject<VitalFormDialogData>(MAT_DIALOG_DATA);

  readonly vitalTypes = VITAL_TYPES;
  readonly isEdit = !!this.data?.log;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    type: [this.data?.log?.type ?? 'BLOOD_PRESSURE', [Validators.required]],
    systolic: [this.data?.log?.systolic ?? null],
    diastolic: [this.data?.log?.diastolic ?? null],
    value: [this.data?.log?.value ?? null],
    unit: [this.data?.log?.unit ?? ''],
    context: [this.data?.log?.context ?? ''],
    notes: [this.data?.log?.notes ?? ''],
    recordedAt: [this.data?.log ? new Date(this.data.log.recordedAt) : new Date(), [Validators.required]],
  });

  get isBloodPressure(): boolean {
    return this.form.controls.type.value === 'BLOOD_PRESSURE';
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
      type: raw.type,
      systolic: this.isBloodPressure && raw.systolic != null ? Number(raw.systolic) : undefined,
      diastolic: this.isBloodPressure && raw.diastolic != null ? Number(raw.diastolic) : undefined,
      value: !this.isBloodPressure && raw.value != null ? Number(raw.value) : undefined,
      unit: raw.unit || undefined,
      context: raw.context || undefined,
      notes: raw.notes || undefined,
      recordedAt: (raw.recordedAt as Date).toISOString(),
    };

    const request = this.isEdit ? this.vitalsService.update(this.data.log!.id, payload) : this.vitalsService.create(payload);

    request.subscribe({
      next: (log) => {
        this.submitting.set(false);
        this.dialogRef.close(log);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save vital log.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
