import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HealthReportDocument } from '../health.model';
import { HealthReportsService } from '../health-reports.service';

const PASSWORD_REQUIRED_CODE = 'PASSWORD_REQUIRED';

@Component({
  selector: 'app-health-report-upload-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './health-report-upload-form.component.html',
})
export class HealthReportUploadFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly healthReportsService = inject(HealthReportsService);
  private readonly dialogRef = inject(MatDialogRef<HealthReportUploadFormComponent>);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly needsPassword = signal(false);
  readonly selectedFile = signal<File | null>(null);

  readonly form = this.fb.nonNullable.group({
    reportDate: [new Date(), [Validators.required]],
    testDate: this.fb.control<Date | null>(null),
    labName: [''],
    password: [''],
  });

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  submit(): void {
    const file = this.selectedFile();
    if (!file || this.form.invalid) {
      this.form.markAllAsTouched();
      if (!file) this.errorMessage.set('Please choose a file to upload.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    this.healthReportsService
      .upload(
        file,
        (raw.reportDate as Date).toISOString(),
        raw.testDate ? (raw.testDate as Date).toISOString() : undefined,
        raw.labName || undefined,
        raw.password || undefined
      )
      .subscribe({
        next: (report: HealthReportDocument) => {
          this.submitting.set(false);
          this.dialogRef.close(report);
        },
        error: (err) => {
          this.submitting.set(false);
          if (err?.status === 422 && err?.error?.errors?.code === PASSWORD_REQUIRED_CODE) {
            this.needsPassword.set(true);
            this.errorMessage.set(err?.error?.message ?? 'This PDF is password-protected. Enter the password and try again.');
            return;
          }
          this.errorMessage.set(err?.error?.message ?? 'Failed to upload and parse the report.');
        },
      });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
