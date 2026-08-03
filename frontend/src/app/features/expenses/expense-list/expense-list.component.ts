import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { PageEvent } from '@angular/material/paginator';
import type { EChartsCoreOption } from 'echarts/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { CHART_PALETTE, gradientFill } from '../../../shared/charts/chart-style.util';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { Expense } from '../expenses.model';
import { ExpensesService } from '../expenses.service';
import { ExpenseFormComponent } from '../expense-form/expense-form.component';
import { BudgetsService } from '../budgets.service';
import { BudgetSummaryItem } from '../budgets.model';
import { BudgetFormComponent } from '../budget-form/budget-form.component';
import { SplitBalancesDialogComponent } from '../split-balances-dialog/split-balances-dialog.component';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { FamilyMember } from '../../family-members/family-members.model';
import { FamilyMembersService } from '../../family-members/family-members.service';

function currency(value: number): string {
  return formatCurrency(value);
}

@Component({
  selector: 'app-expense-list',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    PageHeaderComponent,
    DataTableComponent,
    ChartCardComponent,
  ],
  templateUrl: './expense-list.component.html',
  styleUrl: './expense-list.component.scss'
})
export class ExpenseListComponent {
  private readonly expensesService = inject(ExpensesService);
  private readonly budgetsService = inject(BudgetsService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly familyMembersService = inject(FamilyMembersService);

  readonly loading = signal(true);
  readonly expenses = signal<Expense[]>([]);
  readonly totalCount = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly fromDate = signal<Date | null>(null);
  readonly toDate = signal<Date | null>(null);
  readonly familyMembers = signal<FamilyMember[]>([]);
  readonly selectedFamilyMemberId = signal('');

  readonly budgetItems = signal<BudgetSummaryItem[]>([]);
  readonly budgetLoading = signal(true);
  readonly trendsOptions = signal<EChartsCoreOption | null>(null);
  readonly trendsLoading = signal(true);

  private readonly now = new Date();
  readonly currentMonth = this.now.getMonth() + 1;
  readonly currentYear = this.now.getFullYear();

  readonly columns: DataTableColumn<Expense>[] = [
    { key: 'date', header: 'Date', sortable: true, cell: (row) => new Date(row.date).toLocaleDateString() },
    { key: 'category', header: 'Category', sortable: true },
    { key: 'amount', header: 'Amount', sortable: true, cell: (row) => currency(row.amount) },
    { key: 'paymentMode', header: 'Payment Mode' },
    { key: 'familyMemberName', header: 'Member', cell: (row) => row.familyMemberName ?? '-' },
    { key: 'description', header: 'Description', cell: (row) => row.description ?? '-' },
  ];

  constructor() {
    this.load();
    this.loadBudgets();
    this.loadTrends();
    this.familyMembersService.list().subscribe((members) => this.familyMembers.set(members));
  }

  load(): void {
    this.loading.set(true);
    this.expensesService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        ...(this.fromDate() ? { from: this.fromDate()!.toISOString() } : {}),
        ...(this.toDate() ? { to: this.toDate()!.toISOString() } : {}),
        ...(this.selectedFamilyMemberId() ? { familyMemberId: this.selectedFamilyMemberId() } : {}),
      })
      .subscribe({
        next: ({ data, meta }) => {
          this.expenses.set(data);
          this.totalCount.set(meta?.total ?? data.length);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  loadBudgets(): void {
    this.budgetLoading.set(true);
    this.budgetsService.getSummary(this.currentMonth, this.currentYear, this.selectedFamilyMemberId() || undefined).subscribe({
      next: (summary) => {
        this.budgetItems.set(summary.items);
        this.budgetLoading.set(false);
      },
      error: () => this.budgetLoading.set(false),
    });
  }

  loadTrends(): void {
    this.trendsLoading.set(true);
    this.expensesService.getSpendingTrends(6).subscribe({
      next: (trends) => {
        this.trendsOptions.set({
          tooltip: { trigger: 'axis' },
          grid: { left: 48, right: 16, top: 24, bottom: 32 },
          xAxis: { type: 'category', data: trends.monthly.map((m) => m.label) },
          yAxis: { type: 'value' },
          series: [
            {
              name: 'Spending',
              type: 'line',
              smooth: true,
              symbol: 'circle',
              areaStyle: { color: gradientFill(CHART_PALETTE[0]) },
              itemStyle: { color: CHART_PALETTE[0] },
              data: trends.monthly.map((m) => m.amount),
            },
          ],
        });
        this.trendsLoading.set(false);
      },
      error: () => this.trendsLoading.set(false),
    });
  }

  openBudgetDialog(item?: BudgetSummaryItem): void {
    const ref = this.dialog.open(BudgetFormComponent, {
      width: '480px',
      data: { budget: item, month: this.currentMonth, year: this.currentYear },
    });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Budget saved.');
        this.loadBudgets();
      }
    });
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  onDateFilterChange(): void {
    this.pageIndex.set(0);
    this.load();
  }

  onFamilyMemberFilterChange(): void {
    this.pageIndex.set(0);
    this.load();
    this.loadBudgets();
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(ExpenseFormComponent, { width: '640px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        const addedCount = (result as { addedCount?: number })?.addedCount;
        this.toast.success(addedCount && addedCount > 1 ? `${addedCount} expenses added.` : 'Expense added.');
        this.load();
        this.loadBudgets();
        this.loadTrends();
      }
    });
  }

  openSplitBalancesDialog(): void {
    this.dialog.open(SplitBalancesDialogComponent, { width: '480px' });
  }

  openEditDialog(expense: Expense): void {
    const ref = this.dialog.open(ExpenseFormComponent, { width: '640px', data: { expense } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Expense updated.');
        this.load();
        this.loadBudgets();
        this.loadTrends();
      }
    });
  }

  deleteExpense(expense: Expense): void {
    this.confirmDialog
      .open({
        title: 'Delete expense',
        message: `Are you sure you want to delete this ${expense.category} expense? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.expensesService.remove(expense.id).subscribe(() => {
          this.toast.success('Expense deleted.');
          this.load();
          this.loadBudgets();
          this.loadTrends();
        });
      });
  }

}
