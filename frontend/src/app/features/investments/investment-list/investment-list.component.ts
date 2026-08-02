import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageEvent } from '@angular/material/paginator';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { downloadBlob } from '../../../shared/utils/file-download.util';
import { Investment } from '../investments.model';
import { INVESTMENT_CATEGORY_LABELS, InvestmentCategorySummary } from '../investments.model';
import { InvestmentsService } from '../investments.service';
import { InvestmentFormComponent } from '../investment-form/investment-form.component';
import { ImportResultDialogComponent } from '../import-result-dialog/import-result-dialog.component';
import { InvestmentImportDialogComponent } from '../investment-import/investment-import-dialog/investment-import-dialog.component';
import { InvestmentImportHistoryDialogComponent } from '../investment-import/investment-import-history-dialog/investment-import-history-dialog.component';
import { formatCurrency, currencyCode } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value);
}

@Component({
  selector: 'app-investment-list',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, PageHeaderComponent, DataTableComponent],
  templateUrl: './investment-list.component.html',
  styleUrl: './investment-list.component.scss'
})
export class InvestmentListComponent {
  private readonly investmentsService = inject(InvestmentsService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly loading = signal(true);
  readonly importing = signal(false);
  readonly refreshingPrices = signal(false);
  readonly investments = signal<Investment[]>([]);
  readonly totalCount = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);

  readonly categorySummary = signal<InvestmentCategorySummary[]>([]);
  readonly categorySummaryLoading = signal(true);

  readonly columns: DataTableColumn<Investment>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      cell: (row) => (row.currency && row.currency !== currencyCode() ? `${row.name} [${row.currency}]` : row.name),
    },
    { key: 'category', header: 'Category', sortable: true },
    { key: 'principalAmount', header: 'Principal', sortable: true, cell: (row) => currency(row.principalAmount) },
    { key: 'currentValue', header: 'Current Value', sortable: true, cell: (row) => currency(row.currentValue) },
    { key: 'profit', header: 'Profit', cell: (row) => currency(row.profit) },
    { key: 'roiPercent', header: 'ROI', cell: (row) => `${row.roiPercent}%` },
    { key: 'goalName', header: 'Goal', cell: (row) => row.goalName ?? '-' },
    { key: 'status', header: 'Status' },
  ];

  constructor() {
    this.load();
    this.loadCategorySummary();
  }

  load(): void {
    this.loading.set(true);
    this.investmentsService
      .list({ page: this.pageIndex() + 1, limit: this.pageSize() })
      .subscribe({
        next: ({ data, meta }) => {
          this.investments.set(data);
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

  loadCategorySummary(): void {
    this.categorySummaryLoading.set(true);
    this.investmentsService.getCategorySummary().subscribe({
      next: (summary) => {
        this.categorySummary.set(summary);
        this.categorySummaryLoading.set(false);
      },
      error: () => this.categorySummaryLoading.set(false),
    });
  }

  categoryLabel(category: Investment['category']): string {
    return INVESTMENT_CATEGORY_LABELS[category] ?? category;
  }

  categoryValue(item: InvestmentCategorySummary): string {
    return currency(item.totalCurrentValue);
  }

  categoryPrincipal(item: InvestmentCategorySummary): string {
    return currency(item.totalPrincipal);
  }

  categoryProfit(item: InvestmentCategorySummary): string {
    const formatted = currency(Math.abs(item.totalProfit));
    return item.totalProfit < 0 ? `-${formatted}` : formatted;
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(InvestmentFormComponent, { width: '640px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        const addedCount = (result as { addedCount?: number })?.addedCount;
        this.toast.success(addedCount && addedCount > 1 ? `${addedCount} investments added.` : 'Investment added.');
        this.load();
        this.loadCategorySummary();
      }
    });
  }

  openEditDialog(investment: Investment): void {
    const ref = this.dialog.open(InvestmentFormComponent, { width: '640px', data: { investment } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Investment updated.');
        this.load();
        this.loadCategorySummary();
      }
    });
  }

  deleteInvestment(investment: Investment): void {
    this.confirmDialog
      .open({
        title: 'Delete investment',
        message: `Are you sure you want to delete "${investment.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.investmentsService.remove(investment.id).subscribe(() => {
          this.toast.success('Investment deleted.');
          this.load();
          this.loadCategorySummary();
        });
      });
  }

  exportExcel(): void {
    this.investmentsService.exportExcel().subscribe((blob) => downloadBlob(blob, 'investments.xlsx'));
  }

  exportPdf(): void {
    this.investmentsService.exportPdf().subscribe((blob) => downloadBlob(blob, 'investments.pdf'));
  }

  triggerImport(): void {
    this.fileInput.nativeElement.click();
  }

  openBrokerImportDialog(): void {
    const ref = this.dialog.open(InvestmentImportDialogComponent, { width: '720px', maxWidth: '95vw' });
    ref.afterClosed().subscribe((result) => {
      const imported = (result as { imported?: number })?.imported;
      if (imported && imported > 0) {
        this.toast.success(`${imported} investment${imported > 1 ? 's' : ''} imported.`);
        this.load();
        this.loadCategorySummary();
      }
    });
  }

  openImportHistory(): void {
    this.dialog.open(InvestmentImportHistoryDialogComponent, { width: '640px', maxWidth: '95vw' });
  }

  refreshPrices(): void {
    this.refreshingPrices.set(true);
    this.investmentsService.refreshPrices().subscribe({
      next: (result) => {
        this.refreshingPrices.set(false);
        if (result.updated > 0) {
          this.toast.success(`Updated live prices for ${result.updated} investment${result.updated > 1 ? 's' : ''}.`);
          this.load();
          this.loadCategorySummary();
        } else {
          this.toast.info('No investments could be refreshed (only imported Stocks/Mutual Funds with units are supported).');
        }
      },
      error: (err) => {
        this.refreshingPrices.set(false);
        this.toast.error(err?.error?.message ?? 'Failed to refresh prices.');
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importing.set(true);
    this.investmentsService.import(file).subscribe({
      next: (result) => {
        this.importing.set(false);
        input.value = '';
        this.dialog.open(ImportResultDialogComponent, { width: '600px', data: result });
        if (result.insertedCount > 0) {
          this.load();
          this.loadCategorySummary();
        }
      },
      error: (err) => {
        this.importing.set(false);
        input.value = '';
        this.toast.error(err?.error?.message ?? 'Failed to import file.');
      },
    });
  }
}
