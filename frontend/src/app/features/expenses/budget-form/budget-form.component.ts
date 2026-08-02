import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../expenses.model';
import { Budget } from '../budgets.model';
import { BudgetsService } from '../budgets.service';

export interface BudgetFormDialogData {
  budget?: Budget;
  month: number;
  year: number;
}

@Component({
  selector: 'app-budget-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './budget-form.component.html',
})
export class BudgetFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly budgetsService = inject(BudgetsService);
  private readonly dialogRef = inject(MatDialogRef<BudgetFormComponent>);
  readonly data = inject<BudgetFormDialogData>(MAT_DIALOG_DATA);

  readonly categories = EXPENSE_CATEGORIES;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    category: [this.data.budget?.category ?? ('' as ExpenseCategory | '')],
    amount: [this.data.budget?.amount ?? null, [Validators.required, Validators.min(0.01)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    this.budgetsService
      .upsert({
        category: raw.category ? raw.category : null,
        month: this.data.month,
        year: this.data.year,
        amount: Number(raw.amount),
      })
      .subscribe({
        next: (budget) => {
          this.submitting.set(false);
          this.dialogRef.close(budget);
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.error?.message ?? 'Failed to save budget.');
        },
      });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
