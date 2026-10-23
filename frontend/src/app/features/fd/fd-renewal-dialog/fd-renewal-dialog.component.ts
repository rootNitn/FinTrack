import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FdPortfolioService } from '../fd-portfolio.service';
import { FdPortfolioEntry, FdTenureUnit, RenewFdResult } from '../fd.model';

export interface FdRenewalDialogData {
  entry: FdPortfolioEntry;
}

@Component({
  selector: 'app-fd-renewal-dialog',
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatDialogModule, MatProgressSpinnerModule],
  templateUrl: './fd-renewal-dialog.component.html',
})
export class FdRenewalDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly portfolioService = inject(FdPortfolioService);
  private readonly dialogRef = inject(MatDialogRef<FdRenewalDialogComponent>);
  readonly data = inject<FdRenewalDialogData>(MAT_DIALOG_DATA);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly tenureUnits: FdTenureUnit[] = ['YEARS', 'MONTHS', 'DAYS'];

  readonly form = this.fb.nonNullable.group({
    tenureValue: [1, [Validators.required, Validators.min(1)]],
    tenureUnit: ['YEARS' as FdTenureUnit, Validators.required],
    newInterestRate: [this.data.entry.interestRate, [Validators.min(0.1), Validators.max(20)]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();
    this.portfolioService
      .renew(this.data.entry.id, {
        tenureValue: value.tenureValue,
        tenureUnit: value.tenureUnit,
        newInterestRate: value.newInterestRate,
      })
      .subscribe({
        next: (result: RenewFdResult) => {
          this.submitting.set(false);
          this.dialogRef.close(result);
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.error?.error?.message ?? 'Failed to renew this FD.');
        },
      });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
