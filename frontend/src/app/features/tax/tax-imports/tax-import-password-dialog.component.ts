import { CommonModule } from '@angular/common';
import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TaxImportService } from './tax-import.service';
import { TaxImportRecord, TaxImportType } from './tax-import.model';

export interface TaxImportPasswordDialogData {
  type: TaxImportType;
  documentId: string;
  typeLabel: string;
}

/**
 * Prompts for the password of an encrypted PDF and retries import via the `unlock` endpoint.
 * The password never leaves this component except as the body of that single API call — it is
 * never written to `localStorage`/`sessionStorage`, never logged, and is cleared from the form
 * immediately after each attempt (success or failure).
 */
@Component({
  selector: 'app-tax-import-password-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './tax-import-password-dialog.component.html',
})
export class TaxImportPasswordDialogComponent {
  readonly dialogRef = inject(MatDialogRef<TaxImportPasswordDialogComponent, TaxImportRecord | undefined>);
  private readonly fb = inject(FormBuilder);
  private readonly importService = inject(TaxImportService);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    password: ['', Validators.required],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: TaxImportPasswordDialogData) {}

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const password = this.form.getRawValue().password;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.importService.unlock(this.data.type, this.data.documentId, password).subscribe({
      next: (record) => {
        this.clearPassword();
        this.submitting.set(false);
        this.dialogRef.close(record);
      },
      error: (err) => {
        this.clearPassword();
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Incorrect password. Please try again.');
      },
    });
  }

  cancel(): void {
    this.clearPassword();
    this.dialogRef.close(undefined);
  }

  private clearPassword(): void {
    this.form.reset({ password: '' });
  }
}
