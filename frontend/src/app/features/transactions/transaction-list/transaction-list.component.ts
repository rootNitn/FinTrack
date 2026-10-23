import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ListFilterBarComponent } from '../../../shared/components/list-filter-bar/list-filter-bar.component';
import { Transaction, TransactionType, TRANSACTION_TYPES, TransactionSummary } from '../transactions.model';
import { TransactionsService } from '../transactions.service';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { BanksService } from '../../banks/banks.service';
import { BankAccount } from '../../banks/banks.model';
import { FamilyMembersService } from '../../family-members/family-members.service';
import { FamilyMember } from '../../family-members/family-members.model';
import { formatDate } from '../../../shared/utils/date.util';
import { downloadBlob } from '../../../shared/utils/file-download.util';
import { ToastService } from '../../../core/services/toast.service';
import { ExpensesService } from '../../expenses/expenses.service';
import { ExpenseFormComponent } from '../../expenses/expense-form/expense-form.component';
import { IncomeService } from '../../income/income.service';
import { IncomeFormComponent } from '../../income/income-form/income-form.component';
import { InvestmentsService } from '../../investments/investments.service';
import { InvestmentFormComponent } from '../../investments/investment-form/investment-form.component';

function currency(value: number): string {
  return formatCurrency(value);
}

function date(value: string): string {
  return formatDate(value);
}

const OUTFLOW_TYPES = new Set<TransactionType>(['EXPENSE', 'INVESTMENT_BUY', 'SIP']);

function signedAmount(txn: Transaction): string {
  const sign = OUTFLOW_TYPES.has(txn.type) ? '-' : '+';
  return `${sign} ${currency(Math.abs(txn.amount))}`;
}

function typeLabel(type: TransactionType): string {
  return type.replace(/_/g, ' ');
}

function description(txn: Transaction): string {
  return txn.relatedInvestment?.name ?? txn.description ?? '—';
}

const TYPE_ICONS: Record<TransactionType, { name: string; color: string }> = {
  EXPENSE: { name: 'payments', color: '#ef4444' },
  INCOME: { name: 'attach_money', color: '#22c55e' },
  INVESTMENT_BUY: { name: 'trending_up', color: '#3b82f6' },
  INVESTMENT_SELL: { name: 'trending_down', color: '#f97316' },
  SIP: { name: 'autorenew', color: '#a855f7' },
  TRANSFER: { name: 'swap_horiz', color: '#06b6d4' },
};

const CATEGORY_ICONS: Record<string, { name: string; color: string }> = {
  FOOD: { name: 'restaurant', color: '#f59e0b' },
  GROCERIES: { name: 'shopping_cart', color: '#84cc16' },
  RENT: { name: 'home', color: '#6366f1' },
  FUEL: { name: 'local_gas_station', color: '#ef4444' },
  SHOPPING: { name: 'shopping_bag', color: '#ec4899' },
  ENTERTAINMENT: { name: 'celebration', color: '#a855f7' },
  TRAVEL: { name: 'flight', color: '#0ea5e9' },
  HEALTH: { name: 'local_hospital', color: '#f43f5e' },
  UTILITIES: { name: 'bolt', color: '#eab308' },
  EDUCATION: { name: 'school', color: '#3b82f6' },
  INSURANCE: { name: 'security', color: '#14b8a6' },
  EMI: { name: 'account_balance', color: '#64748b' },
};

function transactionIcon(txn: Transaction): { name: string; color: string } {
  const categoryKey = txn.category?.toUpperCase().replace(/[^A-Z]/g, '_');
  return (categoryKey && CATEGORY_ICONS[categoryKey]) || TYPE_ICONS[txn.type];
}

const EMPTY_SUMMARY: TransactionSummary = { totalIncome: 0, totalExpense: 0, totalInvestments: 0, netCashFlow: 0 };

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
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    PageHeaderComponent,
    DataTableComponent,
    ListFilterBarComponent,
  ],
  templateUrl: './transaction-list.component.html',
  styleUrl: './transaction-list.component.scss',
})
export class TransactionListComponent {
  private readonly transactionsService = inject(TransactionsService);
  private readonly expensesService = inject(ExpensesService);
  private readonly incomeService = inject(IncomeService);
  private readonly investmentsService = inject(InvestmentsService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly banksService = inject(BanksService);
  private readonly familyMembersService = inject(FamilyMembersService);

  readonly loading = signal(true);
  readonly transactions = signal<Transaction[]>([]);
  readonly totalCount = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly typeFilter = signal<TransactionType | ''>('');
  readonly bankAccountFilter = signal('');
  readonly categoryFilter = signal('');
  readonly familyMemberFilter = signal('');
  readonly searchTerm = signal('');
  mobileSearch = '';
  readonly fromDate = signal<Date | null>(null);
  readonly toDate = signal<Date | null>(null);

  readonly bankAccounts = signal<BankAccount[]>([]);
  readonly categories = signal<string[]>([]);
  readonly familyMembers = signal<FamilyMember[]>([]);

  readonly summary = signal<TransactionSummary>(EMPTY_SUMMARY);
  readonly summaryLoading = signal(true);

  readonly transactionTypes = TRANSACTION_TYPES;

  get activeFilterCount(): number {
    return [
      this.typeFilter(),
      this.bankAccountFilter(),
      this.categoryFilter(),
      this.familyMemberFilter(),
      this.searchTerm(),
      this.fromDate(),
      this.toDate(),
    ].filter(Boolean).length;
  }

  readonly columns: DataTableColumn<Transaction>[] = [
    { key: 'date', header: 'Date', sortable: true, cell: (row) => date(row.date) },
    { key: 'type', header: 'Type', sortable: true, cell: (row) => typeLabel(row.type) },
    { key: 'description', header: 'Description', cell: (row) => description(row), icon: (row) => transactionIcon(row) },
    { key: 'account', header: 'Account', cell: (row) => row.bankAccount?.bankName ?? '—' },
    { key: 'category', header: 'Category', cell: (row) => row.category ?? '—' },
    { key: 'familyMemberName', header: 'Member', cell: (row) => row.familyMember?.name ?? '—' },
    { key: 'amount', header: 'Amount', sortable: true, cell: (row) => signedAmount(row) },
  ];

  constructor() {
    this.load();
    this.loadSummary();
    this.banksService.list().subscribe((accounts) => this.bankAccounts.set(accounts));
    this.familyMembersService.list().subscribe((members) => this.familyMembers.set(members));
    this.transactionsService.categories().subscribe((categories) => this.categories.set(categories));
  }

  private filterParams() {
    return {
      ...(this.fromDate() ? { from: this.fromDate()!.toISOString() } : {}),
      ...(this.toDate() ? { to: this.toDate()!.toISOString() } : {}),
      ...(this.bankAccountFilter() ? { bankAccountId: this.bankAccountFilter() } : {}),
      ...(this.categoryFilter() ? { category: this.categoryFilter() } : {}),
      ...(this.familyMemberFilter() ? { familyMemberId: this.familyMemberFilter() } : {}),
      ...(this.searchTerm() ? { search: this.searchTerm() } : {}),
    };
  }

  load(): void {
    this.loading.set(true);
    this.transactionsService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        ...(this.typeFilter() ? { type: this.typeFilter() as TransactionType } : {}),
        ...this.filterParams(),
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

  loadSummary(): void {
    this.summaryLoading.set(true);
    this.transactionsService.summary(this.filterParams()).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.summaryLoading.set(false);
      },
      error: () => this.summaryLoading.set(false),
    });
  }

  exportExcel(): void {
    this.transactionsService
      .exportExcel({
        ...(this.typeFilter() ? { type: this.typeFilter() as TransactionType } : {}),
        ...this.filterParams(),
      })
      .subscribe((blob) => downloadBlob(blob, 'transactions.xlsx'));
  }

  isEditableTransaction(txn: Transaction): boolean {
    return (!!txn.sourceId && (txn.sourceType === 'EXPENSE' || txn.sourceType === 'INCOME')) ||
      (txn.type === 'INVESTMENT_BUY' && !!txn.relatedInvestmentId);
  }

  editTransaction(txn: Transaction): void {
    if (!txn.sourceId) return;

    if (txn.sourceType === 'EXPENSE') {
      this.expensesService.getById(txn.sourceId).subscribe({
        next: (expense) => {
          const ref = this.dialog.open(ExpenseFormComponent, { width: '640px', data: { expense } });
          ref.afterClosed().subscribe((result) => {
            if (result) {
              this.toast.success('Expense updated.');
              this.reload();
            }
          });
        },
        error: () => this.toast.error('Could not load the expense for editing.'),
      });
    } else if (txn.sourceType === 'INCOME') {
      this.incomeService.getById(txn.sourceId).subscribe({
        next: (income) => {
          const ref = this.dialog.open(IncomeFormComponent, { width: '640px', data: { income } });
          ref.afterClosed().subscribe((result) => {
            if (result) {
              this.toast.success('Income updated.');
              this.reload();
            }
          });
        },
        error: () => this.toast.error('Could not load the income for editing.'),
      });
    } else if (txn.type === 'INVESTMENT_BUY' && txn.relatedInvestmentId) {
      this.investmentsService.getById(txn.relatedInvestmentId).subscribe({
        next: (investment) => {
          const ref = this.dialog.open(InvestmentFormComponent, { width: '640px', data: { investment } });
          ref.afterClosed().subscribe((result) => {
            if (result) {
              this.toast.success('Investment updated.');
              this.reload();
            }
          });
        },
        error: () => this.toast.error('Could not load the investment for editing.'),
      });
    }
  }

  reload(): void {
    this.pageIndex.set(0);
    this.load();
    this.loadSummary();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  onTypeFilterChange(): void {
    this.reload();
  }

  onDateFilterChange(): void {
    this.reload();
  }

  onFilterChange(): void {
    this.reload();
  }

  onSearch(value: string): void {
    this.searchTerm.set(value);
    this.reload();
  }

  clearFilters(): void {
    this.typeFilter.set('');
    this.bankAccountFilter.set('');
    this.categoryFilter.set('');
    this.familyMemberFilter.set('');
    this.searchTerm.set('');
    this.fromDate.set(null);
    this.toDate.set(null);
    this.reload();
  }

  currency(value: number): string {
    return currency(value);
  }

  transactionDate(value: string): string {
    return date(value);
  }

  transactionType(type: TransactionType): string {
    return typeLabel(type);
  }

  transactionDescription(txn: Transaction): string {
    return description(txn);
  }

  transactionAmount(txn: Transaction): string {
    return signedAmount(txn);
  }

  isTransactionOutflow(txn: Transaction): boolean {
    return OUTFLOW_TYPES.has(txn.type);
  }
}
