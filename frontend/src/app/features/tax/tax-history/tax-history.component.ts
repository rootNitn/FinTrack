import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageEvent } from '@angular/material/paginator';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { downloadBlob } from '../../../shared/utils/file-download.util';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { TaxService } from '../tax.service';
import { TaxResultComponent } from '../tax-result/tax-result.component';
import { TaxCalculationRecord } from '../tax.model';

@Component({
  selector: 'app-tax-history',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, PageHeaderComponent, DataTableComponent, TaxResultComponent],
  templateUrl: './tax-history.component.html',
  styleUrl: './tax-history.component.scss',
})
export class TaxHistoryComponent implements OnInit {
  private readonly taxService = inject(TaxService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly records = signal<TaxCalculationRecord[]>([]);
  readonly loading = signal(true);
  readonly totalCount = signal(0);
  readonly page = signal(0);
  readonly pageSize = signal(10);
  readonly viewing = signal<TaxCalculationRecord | null>(null);

  readonly columns: DataTableColumn<TaxCalculationRecord>[] = [
    { key: 'financialYearCode', header: 'Financial Year' },
    { key: 'label', header: 'Label', cell: (row) => row.label ?? '—' },
    { key: 'selectedRegime', header: 'Regime', cell: (row) => row.selectedRegime ?? row.result.recommendedRegime },
    {
      key: 'totalTax',
      header: 'Total Tax',
      cell: (row) => formatCurrency(row.result[(row.selectedRegime ?? row.result.recommendedRegime).toLowerCase() as 'old' | 'new'].totalTaxPayable, { maximumFractionDigits: 0 }),
    },
    { key: 'createdAt', header: 'Saved On', cell: (row) => new Date(row.createdAt).toLocaleDateString() },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.taxService.history(this.page() + 1, this.pageSize()).subscribe({
      next: ({ data, meta }) => {
        this.records.set(data);
        this.totalCount.set(meta?.total ?? data.length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onPage(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  view(record: TaxCalculationRecord): void {
    this.viewing.set(record);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  exportExcel(record: TaxCalculationRecord, event: Event): void {
    event.stopPropagation();
    this.taxService.exportHistoryItemExcel(record.id).subscribe({
      next: (blob) => downloadBlob(blob, `tax-calculation-${record.financialYearCode}.xlsx`),
      error: () => this.toast.error('Failed to export Excel.'),
    });
  }

  exportPdf(record: TaxCalculationRecord, event: Event): void {
    event.stopPropagation();
    this.taxService.exportHistoryItemPdf(record.id).subscribe({
      next: (blob) => downloadBlob(blob, `tax-calculation-${record.financialYearCode}.pdf`),
      error: () => this.toast.error('Failed to export PDF.'),
    });
  }

  deleteRecord(record: TaxCalculationRecord, event: Event): void {
    event.stopPropagation();
    this.confirmDialog
      .open({
        title: 'Delete calculation',
        message: `Are you sure you want to delete this saved calculation${record.label ? ` ("${record.label}")` : ''}?`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.taxService.deleteHistoryItem(record.id).subscribe(() => {
          this.toast.success('Calculation deleted.');
          if (this.viewing()?.id === record.id) this.viewing.set(null);
          this.load();
        });
      });
  }
}
