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
import { PageEvent } from '@angular/material/paginator';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { Income } from '../income.model';
import { IncomeService } from '../income.service';
import { IncomeFormComponent } from '../income-form/income-form.component';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value);
}

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
    MatDatepickerModule,
    MatNativeDateModule,
    PageHeaderComponent,
    DataTableComponent,
  ],
  templateUrl: './income-list.component.html',
  styleUrl: './income-list.component.scss'
})
export class IncomeListComponent {
  private readonly incomeService = inject(IncomeService);
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

  readonly columns: DataTableColumn<Income>[] = [
    { key: 'date', header: 'Date', sortable: true, cell: (row) => new Date(row.date).toLocaleDateString() },
    { key: 'source', header: 'Source', sortable: true },
    { key: 'amount', header: 'Amount', sortable: true, cell: (row) => currency(row.amount) },
    { key: 'description', header: 'Description', cell: (row) => row.description ?? '-' },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.incomeService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        ...(this.fromDate() ? { from: this.fromDate()!.toISOString() } : {}),
        ...(this.toDate() ? { to: this.toDate()!.toISOString() } : {}),
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

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  onDateFilterChange(): void {
    this.pageIndex.set(0);
    this.load();
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(IncomeFormComponent, { width: '640px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Income added.');
        this.load();
      }
    });
  }

  openEditDialog(income: Income): void {
    const ref = this.dialog.open(IncomeFormComponent, { width: '640px', data: { income } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Income updated.');
        this.load();
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
          this.load();
        });
      });
  }

}
