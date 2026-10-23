import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { formatDate } from '../../../shared/utils/date.util';
import { Transaction } from '../../transactions/transactions.model';
import { TransactionsService } from '../../transactions/transactions.service';
import { BankAccount } from '../banks.model';
import { BankFormComponent } from '../bank-form/bank-form.component';
import { BanksService } from '../banks.service';

@Component({
  selector: 'app-bank-detail',
  imports: [CommonModule, RouterLink, MatPaginatorModule, MatButtonModule, MatIconModule, PageHeaderComponent],
  templateUrl: './bank-detail.component.html',
})
export class BankDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly banksService = inject(BanksService);
  private readonly transactionsService = inject(TransactionsService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly accountId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly account = signal<BankAccount | null>(null);
  readonly transactions = signal<Transaction[]>([]);
  readonly accountLoading = signal(true);
  readonly historyLoading = signal(true);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly totalCount = signal(0);

  constructor() {
    this.loadAccount();
    this.loadTransactions();
  }

  loadAccount(): void {
    this.accountLoading.set(true);
    this.banksService.getById(this.accountId).subscribe({
      next: (account) => {
        this.account.set(account);
        this.accountLoading.set(false);
      },
      error: () => {
        this.accountLoading.set(false);
        this.toast.error('Could not load this bank account.');
      },
    });
  }

  loadTransactions(): void {
    this.historyLoading.set(true);
    this.transactionsService.list({
      bankAccountId: this.accountId,
      page: this.pageIndex() + 1,
      limit: this.pageSize(),
      sortBy: 'date',
      sortDir: 'desc',
    }).subscribe({
      next: ({ data, meta }) => {
        this.transactions.set(data);
        this.totalCount.set(meta?.total ?? data.length);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyLoading.set(false);
        this.toast.error('Could not load transaction history.');
      },
    });
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadTransactions();
  }

  openEditDialog(): void {
    const account = this.account();
    if (!account) return;
    const ref = this.dialog.open(BankFormComponent, { width: '600px', data: { account } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Bank account updated.');
        this.loadAccount();
      }
    });
  }

  amount(value: number): string {
    return formatCurrency(value);
  }

  date(value: string): string {
    return formatDate(value);
  }

  description(txn: Transaction): string {
    return txn.relatedInvestment?.name ?? txn.description ?? txn.category ?? 'Transaction';
  }
}