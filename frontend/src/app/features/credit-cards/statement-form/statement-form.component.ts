import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CreditCardsService } from '../credit-cards.service';

export interface StatementFormDialogData {
  cardId: string;
}

@Component({
  selector: 'app-statement-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './statement-form.component.html',
  styleUrl: './statement-form.component.scss',
})
export class StatementFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly creditCardsService = inject(CreditCardsService);
  private readonly dialogRef = inject(MatDialogRef<StatementFormComponent>);
  readonly data = inject<StatementFormDialogData>(MAT_DIALOG_DATA);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    month: [new Date().getMonth() + 1, [Validators.required, Validators.min(1), Validators.max(12)]],
    year: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]],
    statementDate: [new Date(), [Validators.required]],
    dueDate: [new Date(), [Validators.required]],
    totalDue: [null as number | null, [Validators.required, Validators.min(0)]],
    minimumDue: [null as number | null, [Validators.required, Validators.min(0)]],
    rewardPointsEarned: [0, [Validators.required, Validators.min(0)]],
    cashbackEarned: [0, [Validators.required, Validators.min(0)]],
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
      month: Number(raw.month),
      year: Number(raw.year),
      statementDate: new Date(raw.statementDate).toISOString(),
      dueDate: new Date(raw.dueDate).toISOString(),
      totalDue: Number(raw.totalDue),
      minimumDue: Number(raw.minimumDue),
      rewardPointsEarned: Number(raw.rewardPointsEarned),
      cashbackEarned: Number(raw.cashbackEarned),
    };

    this.creditCardsService.createStatement(this.data.cardId, payload).subscribe({
      next: (statement) => {
        this.submitting.set(false);
        this.dialogRef.close(statement);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to add statement.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
