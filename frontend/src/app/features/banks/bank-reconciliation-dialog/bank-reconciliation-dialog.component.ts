import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastService } from '../../../core/services/toast.service';
import { BankImportService } from '../bank-import.service';
import { BankImportColumns, BankImportCommitEntry, BankImportCommitResult, BankImportMapping, BankImportReconcileResult } from '../bank-import.model';
import { BankAccount } from '../banks.model';
import { EXPENSE_CATEGORIES, ExpenseCategory, PAYMENT_MODES, PaymentMode } from '../../expenses/expenses.model';
import { INCOME_SOURCES, IncomeSource } from '../../income/income.model';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { formatDate } from '../../../shared/utils/date.util';

export interface BankReconciliationDialogData {
  accounts: BankAccount[];
}

interface ImportRowState {
  selected: boolean;
  type: 'EXPENSE' | 'INCOME';
  category: ExpenseCategory;
  paymentMode: PaymentMode;
  source: IncomeSource;
}

@Component({
  selector: 'app-bank-reconciliation-dialog',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './bank-reconciliation-dialog.component.html',
})
export class BankReconciliationDialogComponent {
  private readonly bankImportService = inject(BankImportService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<BankReconciliationDialogComponent>);
  readonly data = inject<BankReconciliationDialogData>(MAT_DIALOG_DATA);

  readonly step = signal<'upload' | 'map' | 'results'>('upload');
  readonly loading = signal(false);
  readonly file = signal<File | null>(null);
  readonly columns = signal<BankImportColumns | null>(null);
  readonly result = signal<BankImportReconcileResult | null>(null);

  readonly dateColumn = signal('');
  readonly descriptionColumn = signal('');
  readonly amountColumn = signal('');
  readonly debitColumn = signal('');
  readonly creditColumn = signal('');
  readonly bankAccountId = signal('');
  readonly toleranceDays = signal(3);
  readonly toleranceAmount = signal(1);

  // One-click convert-unmatched-rows-to-transactions state.
  readonly importRowState = signal<Record<number, ImportRowState>>({});
  readonly committing = signal(false);
  readonly commitSummary = signal<{ created: number; failed: number } | null>(null);
  readonly committedRowNumbers = signal<Set<number>>(new Set());
  readonly expenseCategories = EXPENSE_CATEGORIES;
  readonly paymentModes = PAYMENT_MODES;
  readonly incomeSources = INCOME_SOURCES;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = input.files?.[0] ?? null;
    this.file.set(selected);
  }

  uploadForColumns(): void {
    const file = this.file();
    if (!file) {
      this.toast.error('Choose a bank statement file first.');
      return;
    }
    this.loading.set(true);
    this.bankImportService.getColumns(file).subscribe({
      next: (columns) => {
        this.loading.set(false);
        this.columns.set(columns);
        this.step.set('map');
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err?.error?.message ?? 'Could not read this file.');
      },
    });
  }

  runReconciliation(): void {
    const file = this.file();
    if (!file) return;
    if (!this.dateColumn() || !this.descriptionColumn() || (!this.amountColumn() && !this.debitColumn() && !this.creditColumn())) {
      this.toast.error('Map a Date column, a Description column, and either an Amount column or Debit/Credit columns.');
      return;
    }

    const mapping: BankImportMapping = {
      date: this.dateColumn(),
      description: this.descriptionColumn(),
      amount: this.amountColumn() || null,
      debit: this.debitColumn() || null,
      credit: this.creditColumn() || null,
      bankAccountId: this.bankAccountId() || null,
      toleranceDays: this.toleranceDays(),
      toleranceAmount: this.toleranceAmount(),
    };

    this.loading.set(true);
    this.bankImportService.reconcile(file, mapping).subscribe({
      next: (result) => {
        this.loading.set(false);
        this.result.set(result);
        this.step.set('results');
        this.initImportRowState(result);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err?.error?.message ?? 'Reconciliation failed.');
      },
    });
  }

  /** Defaults each unmatched row to Expense/Income based on the amount's sign (credit = Income, debit = Expense). */
  private initImportRowState(result: BankImportReconcileResult): void {
    const state: Record<number, ImportRowState> = {};
    for (const row of result.rows) {
      if (row.matched) continue;
      state[row.rowNumber] = {
        selected: false,
        type: row.amount > 0 ? 'INCOME' : 'EXPENSE',
        category: 'OTHERS',
        paymentMode: 'BANK_TRANSFER',
        source: 'OTHER_INCOME',
      };
    }
    this.importRowState.set(state);
    this.commitSummary.set(null);
    this.committedRowNumbers.set(new Set());
  }

  rowState(rowNumber: number): ImportRowState {
    return this.importRowState()[rowNumber];
  }

  updateRowState(rowNumber: number, patch: Partial<ImportRowState>): void {
    this.importRowState.update((state) => ({ ...state, [rowNumber]: { ...state[rowNumber], ...patch } }));
  }

  get selectedCount(): number {
    return Object.values(this.importRowState()).filter((s) => s.selected).length;
  }

  /** Converts the selected unmatched rows into real Expense/Income entries in one click. */
  commitSelected(): void {
    const res = this.result();
    if (!res) return;

    const entries: BankImportCommitEntry[] = Object.entries(this.importRowState())
      .filter(([, s]) => s.selected)
      .map(([rowNumberStr, s]) => {
        const rowNumber = Number(rowNumberStr);
        const row = res.rows.find((r) => r.rowNumber === rowNumber)!;
        return {
          rowNumber,
          date: row.date,
          description: row.description,
          amount: Math.abs(row.amount),
          type: s.type,
          category: s.type === 'EXPENSE' ? s.category : undefined,
          paymentMode: s.type === 'EXPENSE' ? s.paymentMode : undefined,
          source: s.type === 'INCOME' ? s.source : undefined,
          bankAccountId: this.bankAccountId() || undefined,
        };
      });

    if (!entries.length) {
      this.toast.error('Select at least one unmatched row to import.');
      return;
    }

    this.committing.set(true);
    this.bankImportService.commit(entries).subscribe({
      next: (result: BankImportCommitResult) => {
        this.committing.set(false);
        this.commitSummary.set({ created: result.created, failed: result.failed });
        this.committedRowNumbers.set(new Set(result.results.filter((r) => r.success).map((r) => r.rowNumber)));
        if (result.failed) {
          this.toast.error(`${result.created} row(s) added, ${result.failed} failed.`);
        } else {
          this.toast.success(`${result.created} row(s) added as transactions.`);
        }
      },
      error: (err) => {
        this.committing.set(false);
        this.toast.error(err?.error?.message ?? 'Failed to import selected rows.');
      },
    });
  }

  formatMoney(value: number): string {
    return formatCurrency(value);
  }

  formatDate(value: string): string {
    return formatDate(value);
  }

  close(): void {
    this.dialogRef.close();
  }
}
