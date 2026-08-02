import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from '../../../core/services/toast.service';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { ExpensesService } from '../expenses.service';
import { ExpenseSplitsSummary, UnsettledExpenseSplit } from '../expenses.model';

function currency(value: number): string {
  return formatCurrency(value);
}

function date(value: string): string {
  return new Date(value).toLocaleDateString();
}

@Component({
  selector: 'app-split-balances-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './split-balances-dialog.component.html',
  styleUrl: './split-balances-dialog.component.scss',
})
export class SplitBalancesDialogComponent implements OnInit {
  private readonly expensesService = inject(ExpensesService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<SplitBalancesDialogComponent>);

  readonly loading = signal(true);
  readonly summary = signal<ExpenseSplitsSummary | null>(null);
  readonly settlingId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.expensesService.getSplitsSummary().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  markSettled(split: UnsettledExpenseSplit): void {
    this.settlingId.set(split.id);
    this.expensesService.setSplitSettled(split.expenseId, split.id, true).subscribe({
      next: () => {
        this.toast.success(`Marked ${split.participantName}'s split as settled.`);
        this.settlingId.set(null);
        this.load();
      },
      error: () => {
        this.toast.error('Failed to update split.');
        this.settlingId.set(null);
      },
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  currency(value: number): string {
    return currency(value);
  }

  date(value: string): string {
    return date(value);
  }
}
