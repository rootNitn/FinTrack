import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { PageEvent } from '@angular/material/paginator';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { Transaction, TransactionType, TRANSACTION_TYPES } from '../transactions.model';
import { TransactionsService } from '../transactions.service';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value);
}

function date(value: string): string {
  return new Date(value).toLocaleDateString();
}

const OUTFLOW_TYPES = new Set<TransactionType>(['EXPENSE', 'INVESTMENT_BUY', 'SIP']);

function signedAmount(txn: Transaction): string {
  const sign = OUTFLOW_TYPES.has(txn.type) ? '-' : '+';
  return `${sign} ${currency(Math.abs(txn.amount))}`;
}

function typeLabel(type: TransactionType): string {
  return type.replace(/_/g, ' ');
}

function relatedTo(txn: Transaction): string {
  return txn.relatedInvestment?.name ?? txn.bankAccount?.bankName ?? txn.description ?? '—';
}

@Component({
  selector: 'app-transaction-list',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    PageHeaderComponent,
    DataTableComponent,
  ],
  templateUrl: './transaction-list.component.html',
  styleUrl: './transaction-list.component.scss',
})
export class TransactionListComponent {
  private readonly transactionsService = inject(TransactionsService);

  readonly loading = signal(true);
  readonly transactions = signal<Transaction[]>([]);
  readonly totalCount = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly typeFilter = signal<TransactionType | ''>('');
  readonly fromDate = signal<Date | null>(null);
  readonly toDate = signal<Date | null>(null);

  readonly transactionTypes = TRANSACTION_TYPES;

  readonly columns: DataTableColumn<Transaction>[] = [
    { key: 'date', header: 'Date', sortable: true, cell: (row) => date(row.date) },
    { key: 'type', header: 'Type', sortable: true, cell: (row) => typeLabel(row.type) },
    { key: 'related', header: 'Description', cell: (row) => relatedTo(row) },
    { key: 'category', header: 'Category', cell: (row) => row.category ?? '—' },
    { key: 'amount', header: 'Amount', sortable: true, cell: (row) => signedAmount(row) },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.transactionsService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        ...(this.typeFilter() ? { type: this.typeFilter() as TransactionType } : {}),
        ...(this.fromDate() ? { from: this.fromDate()!.toISOString() } : {}),
        ...(this.toDate() ? { to: this.toDate()!.toISOString() } : {}),
      })
      .subscribe({
        next: ({ data, meta }) => {
          this.transactions.set(data);
          this.totalCount.set(meta?.total ?? data.length);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  onTypeFilterChange(): void {
    this.pageIndex.set(0);
    this.load();
  }

  onDateFilterChange(): void {
    this.pageIndex.set(0);
    this.load();
  }
}
