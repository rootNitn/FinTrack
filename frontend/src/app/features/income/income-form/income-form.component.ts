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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { INCOME_SOURCES, Income, RECURRENCE_INTERVALS } from '../income.model';
import { IncomeService } from '../income.service';
import { BankAccount } from '../../banks/banks.model';
import { BanksService } from '../../banks/banks.service';

export interface IncomeFormDialogData {
  income?: Income;
}

@Component({
  selector: 'app-income-form',
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
    MatCheckboxModule,
  ],
  templateUrl: './income-form.component.html',
  styleUrl: './income-form.component.scss'
})
export class IncomeFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly incomeService = inject(IncomeService);
  private readonly banksService = inject(BanksService);
  private readonly dialogRef = inject(MatDialogRef<IncomeFormComponent>);
  readonly data = inject<IncomeFormDialogData>(MAT_DIALOG_DATA);

  readonly sources = INCOME_SOURCES;
  readonly recurrenceIntervals = RECURRENCE_INTERVALS;
  readonly bankAccounts = signal<BankAccount[]>([]);
  readonly isEdit = !!this.data?.income;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    date: [this.data?.income ? new Date(this.data.income.date) : new Date(), [Validators.required]],
    source: [this.data?.income?.source ?? 'SALARY', [Validators.required]],
    amount: [this.data?.income?.amount ?? null, [Validators.required, Validators.min(0.01)]],
    description: [this.data?.income?.description ?? ''],
    bankAccountId: [this.data?.income?.bankAccountId ?? ''],
    isRecurring: [this.data?.income?.isRecurring ?? false],
    recurrenceInterval: [this.data?.income?.recurrenceInterval ?? 'MONTHLY'],
    recurrenceEndDate: [this.data?.income?.recurrenceEndDate ? new Date(this.data.income.recurrenceEndDate) : null],
  });

  constructor() {
    this.banksService.list().subscribe((accounts) => this.bankAccounts.set(accounts));
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
      date: (raw.date as Date).toISOString(),
      source: raw.source,
      amount: Number(raw.amount),
      description: raw.description || undefined,
      bankAccountId: raw.bankAccountId || undefined,
      isRecurring: raw.isRecurring,
      recurrenceInterval: raw.isRecurring ? raw.recurrenceInterval : undefined,
      recurrenceEndDate: raw.isRecurring && raw.recurrenceEndDate ? (raw.recurrenceEndDate as Date).toISOString() : undefined,
    };

    const request = this.isEdit
      ? this.incomeService.update(this.data.income!.id, payload)
      : this.incomeService.create(payload);

    request.subscribe({
      next: (income) => {
        this.submitting.set(false);
        this.dialogRef.close(income);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save income.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

}
