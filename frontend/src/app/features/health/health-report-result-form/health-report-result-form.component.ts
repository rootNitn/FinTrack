import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HealthReportResult } from '../health.model';
import { HealthReportsService } from '../health-reports.service';

export interface HealthReportResultFormDialogData {
  reportId: string;
  result?: HealthReportResult;
}

@Component({
  selector: 'app-health-report-result-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './health-report-result-form.component.html',
})
export class HealthReportResultFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly healthReportsService = inject(HealthReportsService);
  private readonly dialogRef = inject(MatDialogRef<HealthReportResultFormComponent>);
  readonly data = inject<HealthReportResultFormDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data?.result;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    testName: [this.data?.result?.testName ?? '', [Validators.required]],
    value: [this.data?.result?.value ?? null, [Validators.required]],
    unit: [this.data?.result?.unit ?? ''],
    referenceLow: [this.data?.result?.referenceLow ?? null],
    referenceHigh: [this.data?.result?.referenceHigh ?? null],
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
      testName: raw.testName,
      value: Number(raw.value),
      unit: raw.unit || undefined,
      referenceLow: raw.referenceLow != null ? Number(raw.referenceLow) : undefined,
      referenceHigh: raw.referenceHigh != null ? Number(raw.referenceHigh) : undefined,
    };

    const request = this.isEdit
      ? this.healthReportsService.updateResult(this.data.reportId, this.data.result!.id, payload)
      : this.healthReportsService.addResult(this.data.reportId, payload);

    request.subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save result.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
