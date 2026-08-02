import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EXPENSE_CATEGORIES, Expense, ExpenseCategory, PAYMENT_MODES, PaymentMode, RECURRENCE_INTERVALS } from '../expenses.model';
import { ExpensesService } from '../expenses.service';
import { BankAccount } from '../../banks/banks.model';
import { BanksService } from '../../banks/banks.service';
import { FamilyMember } from '../../family-members/family-members.model';
import { FamilyMembersService } from '../../family-members/family-members.service';

export interface ExpenseFormDialogData {
  expense?: Expense;
}

interface LastExpenseDefaults {
  category: ExpenseCategory;
  paymentMode: PaymentMode;
  bankAccountId: string;
}

const LAST_DEFAULTS_KEY = 'ft:lastExpenseDefaults';

function readLastDefaults(): Partial<LastExpenseDefaults> {
  try {
    return JSON.parse(localStorage.getItem(LAST_DEFAULTS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeLastDefaults(defaults: LastExpenseDefaults): void {
  try {
    localStorage.setItem(LAST_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch {
    // localStorage unavailable (e.g. private browsing) — safe to ignore.
  }
}

@Component({
  selector: 'app-expense-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './expense-form.component.html',
  styleUrl: './expense-form.component.scss'
})
export class ExpenseFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly expensesService = inject(ExpensesService);
  private readonly banksService = inject(BanksService);
  private readonly familyMembersService = inject(FamilyMembersService);
  private readonly dialogRef = inject(MatDialogRef<ExpenseFormComponent>);
  readonly data = inject<ExpenseFormDialogData>(MAT_DIALOG_DATA);

  readonly categories = EXPENSE_CATEGORIES;
  readonly paymentModes = PAYMENT_MODES;
  readonly recurrenceIntervals = RECURRENCE_INTERVALS;
  readonly bankAccounts = signal<BankAccount[]>([]);
  readonly familyMembers = signal<FamilyMember[]>([]);
  readonly isEdit = !!this.data?.expense;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showSplits = signal(!!this.data?.expense?.splits?.length);
  readonly receiptFile = signal<File | null>(null);
  readonly existingReceiptUrl = signal<string | null | undefined>(this.data?.expense?.receiptUrl);
  private readonly lastDefaults = this.isEdit ? {} : readLastDefaults();

  /** Number of expenses added so far via "Save & Add Another" in this dialog session. */
  readonly addedCount = signal(0);
  readonly justAdded = signal(false);

  readonly form = this.fb.nonNullable.group({
    date: [this.data?.expense ? new Date(this.data.expense.date) : new Date(), [Validators.required]],
    category: [this.data?.expense?.category ?? this.lastDefaults.category ?? 'FOOD', [Validators.required]],
    amount: [this.data?.expense?.amount ?? null, [Validators.required, Validators.min(0.01)]],
    paymentMode: [this.data?.expense?.paymentMode ?? this.lastDefaults.paymentMode ?? 'CASH', [Validators.required]],
    description: [this.data?.expense?.description ?? ''],
    bankAccountId: [this.data?.expense?.bankAccountId ?? this.lastDefaults.bankAccountId ?? ''],
    isRecurring: [this.data?.expense?.isRecurring ?? false],
    recurrenceInterval: [this.data?.expense?.recurrenceInterval ?? 'MONTHLY'],
    recurrenceEndDate: [this.data?.expense?.recurrenceEndDate ? new Date(this.data.expense.recurrenceEndDate) : null],
    familyMemberId: [this.data?.expense?.familyMemberId ?? ''],
    splits: this.fb.array(
      (this.data?.expense?.splits ?? []).map((s) =>
        this.fb.nonNullable.group({
          participantName: [s.participantName, [Validators.required]],
          amount: [s.amount, [Validators.required, Validators.min(0.01)]],
        })
      )
    ),
  });

  get splits() {
    return this.form.controls.splits;
  }

  constructor() {
    this.banksService.list().subscribe((accounts) => this.bankAccounts.set(accounts));
    this.familyMembersService.list().subscribe((members) => this.familyMembers.set(members));
  }

  toggleSplits(): void {
    this.showSplits.set(!this.showSplits());
    if (!this.showSplits()) {
      this.splits.clear();
    } else if (!this.splits.length) {
      this.addSplitRow();
    }
  }

  addSplitRow(): void {
    this.splits.push(
      this.fb.nonNullable.group({
        participantName: ['', [Validators.required]],
        amount: [null as unknown as number, [Validators.required, Validators.min(0.01)]],
      })
    );
  }

  removeSplitRow(index: number): void {
    this.splits.removeAt(index);
  }

  onReceiptSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.receiptFile.set(input.files?.[0] ?? null);
  }

  submit(keepOpen = false): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.justAdded.set(false);

    const raw = this.form.getRawValue();
    const payload = {
      date: (raw.date as Date).toISOString(),
      category: raw.category,
      amount: Number(raw.amount),
      paymentMode: raw.paymentMode,
      description: raw.description || undefined,
      bankAccountId: raw.bankAccountId || undefined,
      isRecurring: raw.isRecurring,
      recurrenceInterval: raw.isRecurring ? raw.recurrenceInterval : undefined,
      recurrenceEndDate: raw.isRecurring && raw.recurrenceEndDate ? (raw.recurrenceEndDate as Date).toISOString() : undefined,
      familyMemberId: raw.familyMemberId || null,
      splits: this.showSplits() && raw.splits.length ? raw.splits.map((s) => ({ participantName: s.participantName, amount: Number(s.amount) })) : undefined,
    };

    if (!this.isEdit) {
      writeLastDefaults({ category: raw.category, paymentMode: raw.paymentMode, bankAccountId: raw.bankAccountId ?? '' });
    }

    const request = this.isEdit
      ? this.expensesService.update(this.data.expense!.id, payload)
      : this.expensesService.create(payload);

    request.subscribe({
      next: (expense) => {
        const file = this.receiptFile();
        if (file) {
          this.expensesService.uploadReceipt(expense.id, file).subscribe({
            next: (updated) => this.handleSaved(updated, keepOpen),
            error: () => this.handleSaved(expense, keepOpen),
          });
        } else {
          this.handleSaved(expense, keepOpen);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save expense.');
      },
    });
  }

  private handleSaved(expense: Expense, keepOpen: boolean): void {
    this.submitting.set(false);

    if (this.isEdit || !keepOpen) {
      this.dialogRef.close(expense);
      return;
    }

    // "Save & Add Another": keep the dialog open, clear the one-off fields, and let the
    // user fire off the next entry quickly with category/payment mode/bank account retained.
    this.addedCount.update((n) => n + 1);
    this.justAdded.set(true);
    this.receiptFile.set(null);
    this.existingReceiptUrl.set(null);
    this.form.patchValue({ amount: null, description: '' });
    this.form.controls.amount.markAsUntouched();
    this.form.controls.amount.markAsPristine();
  }

  /** Closes the dialog, reporting whether any expense was actually added this session. */
  cancel(): void {
    this.dialogRef.close(this.addedCount() > 0 ? { addedCount: this.addedCount() } : undefined);
  }

}

