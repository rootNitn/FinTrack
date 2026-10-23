import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BodyMetricLog } from '../health.model';
import { BodyMetricsService } from '../body-metrics.service';

export interface BodyMetricFormDialogData {
  log?: BodyMetricLog;
}

@Component({
  selector: 'app-body-metric-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './body-metric-form.component.html',
})
export class BodyMetricFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly bodyMetricsService = inject(BodyMetricsService);
  private readonly dialogRef = inject(MatDialogRef<BodyMetricFormComponent>);
  readonly data = inject<BodyMetricFormDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data?.log;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    recordedAt: [this.data?.log ? new Date(this.data.log.recordedAt) : new Date(), [Validators.required]],
    weightKg: [this.data?.log?.weightKg ?? null, [Validators.required, Validators.min(1)]],
    heightCm: [this.data?.log?.heightCm ?? null],
    bodyFatPercent: [this.data?.log?.bodyFatPercent ?? null],
    waistCm: [this.data?.log?.waistCm ?? null],
    notes: [this.data?.log?.notes ?? ''],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      recordedAt: (raw.recordedAt as Date).toISOString(),
      weightKg: Number(raw.weightKg),
      heightCm: raw.heightCm != null ? Number(raw.heightCm) : undefined,
      bodyFatPercent: raw.bodyFatPercent != null ? Number(raw.bodyFatPercent) : undefined,
      waistCm: raw.waistCm != null ? Number(raw.waistCm) : undefined,
      notes: raw.notes || undefined,
    };

    const request = this.isEdit
      ? this.bodyMetricsService.update(this.data.log!.id, payload)
      : this.bodyMetricsService.create(payload);

    request.subscribe({
      next: (log) => {
        this.submitting.set(false);
        this.dialogRef.close(log);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save body metric log.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
