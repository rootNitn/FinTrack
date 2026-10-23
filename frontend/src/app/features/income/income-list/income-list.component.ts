import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { Income, INCOME_SOURCES, IncomeSource, IncomeSummary } from '../income.model';
import { IncomeService } from '../income.service';
import { IncomeFormComponent } from '../income-form/income-form.component';
import { IncomeSourceFormComponent } from '../income-source-form/income-source-form.component';
import { IncomeSourceManagerComponent } from '../income-source-manager/income-source-manager.component';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { formatDate } from '../../../shared/utils/date.util';
import { downloadBlob } from '../../../shared/utils/file-download.util';
import { BanksService } from '../../banks/banks.service';
import { BankAccount } from '../../banks/banks.model';
import { FamilyMembersService } from '../../family-members/family-members.service';
import { FamilyMember } from '../../family-members/family-members.model';
import { ListFilterBarComponent } from '../../../shared/components/list-filter-bar/list-filter-bar.component';

function currency(value: number): string {
  return formatCurrency(value);
}

const EMPTY_SUMMARY: IncomeSummary = { totalIncome: 0, salary: 0, interest: 0, other: 0 };

@Component({
  selector: 'app-income-list',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatPaginatorModule,
    PageHeaderComponent,
    DataTableComponent,
    ListFilterBarComponent,
  ],
  templateUrl: './income-list.component.html',
  styleUrl: './income-list.component.scss'
})
export class IncomeListComponent {
  private readonly incomeService = inject(IncomeService);
  private readonly banksService = inject(BanksService);
  private readonly familyMembersService = inject(FamilyMembersService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly incomes = signal<Income[]>([]);
  readonly totalCount = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly fromDate = signal<Date | null>(null);
  readonly toDate = signal<Date | null>(null);
  readonly sourceFilter = signal<IncomeSource | ''>('');
  readonly bankAccountFilter = signal('');
  readonly familyMemberFilter = signal('');
  readonly searchTerm = signal('');

  get activeFilterCount(): number {
    return Number(!!this.fromDate()) + Number(!!this.toDate()) + Number(!!this.sourceFilter()) + Number(!!this.bankAccountFilter()) + Number(!!this.familyMemberFilter()) + Number(!!this.searchTerm());
  }

  readonly bankAccounts = signal<BankAccount[]>([]);
  readonly familyMembers = signal<FamilyMember[]>([]);

  readonly summary = signal<IncomeSummary>(EMPTY_SUMMARY);
  readonly summaryLoading = signal(true);

  readonly sources = INCOME_SOURCES;

  readonly columns: DataTableColumn<Income>[] = [
    { key: 'date', header: 'Date', sortable: true, cell: (row) => formatDate(row.date) },
    { key: 'source', header: 'Source', sortable: true },
    { key: 'account', header: 'Account', cell: (row) => row.bankAccount?.bankName ?? '—' },
    { key: 'amount', header: 'Amount', sortable: true, cell: (row) => currency(row.amount) },
    { key: 'familyMemberName', header: 'Member', cell: (row) => row.familyMember?.name ?? '—' },
    { key: 'description', header: 'Description', cell: (row) => row.description ?? '-' },
  ];

  constructor() {
    this.load();
    this.loadSummary();
    this.banksService.list().subscribe((accounts) => this.bankAccounts.set(accounts));
    this.familyMembersService.list().subscribe((members) => this.familyMembers.set(members));
  }

  private filterParams() {
    return {
      ...(this.fromDate() ? { from: this.fromDate()!.toISOString() } : {}),
      ...(this.toDate() ? { to: this.toDate()!.toISOString() } : {}),
      ...(this.sourceFilter() ? { source: this.sourceFilter() as IncomeSource } : {}),
      ...(this.bankAccountFilter() ? { bankAccountId: this.bankAccountFilter() } : {}),
      ...(this.familyMemberFilter() ? { familyMemberId: this.familyMemberFilter() } : {}),
      ...(this.searchTerm() ? { search: this.searchTerm() } : {}),
    };
  }

  load(): void {
    this.loading.set(true);
    this.incomeService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        ...this.filterParams(),
      })
      .subscribe({
        next: ({ data, meta }) => {
          this.incomes.set(data);
          this.totalCount.set(meta?.total ?? data.length);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  exportExcel(): void {
    this.incomeService.exportExcel(this.filterParams()).subscribe((blob) => downloadBlob(blob, 'income.xlsx'));
  }

  loadSummary(): void {
    this.summaryLoading.set(true);
    this.incomeService.summary(this.filterParams()).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.summaryLoading.set(false);
      },
      error: () => this.summaryLoading.set(false),
    });
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
    this.fromDate.set(null);
    this.toDate.set(null);
    this.sourceFilter.set('');
    this.bankAccountFilter.set('');
    this.familyMemberFilter.set('');
    this.searchTerm.set('');
    this.reload();
  }

  currency(value: number): string {
    return currency(value);
  }

  incomeDate(value: string): string {
    return formatDate(value);
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(IncomeFormComponent, { width: '640px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Income added.');
        this.reload();
      }
    });
  }

  openIncomeSourceDialog(): void {
    this.dialog.open(IncomeSourceManagerComponent, { width: '720px' });
  }

  openEditDialog(income: Income): void {
    const ref = this.dialog.open(IncomeFormComponent, { width: '640px', data: { income } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Income updated.');
        this.reload();
      }
    });
  }

  deleteIncome(income: Income): void {
    this.confirmDialog
      .open({
        title: 'Delete income',
        message: `Are you sure you want to delete this ${income.source} income entry? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.incomeService.remove(income.id).subscribe(() => {
          this.toast.success('Income deleted.');
          this.reload();
        });
      });
  }

}
