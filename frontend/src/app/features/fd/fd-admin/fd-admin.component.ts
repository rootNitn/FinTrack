import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { FdBanksService } from '../fd-banks.service';
import { FdBank, FD_BANK_TYPE_LABELS, FdImportResult } from '../fd.model';
import { FdBankFormComponent } from '../fd-bank-form/fd-bank-form.component';
import { FdRateManagerDialogComponent } from '../fd-rate-manager-dialog/fd-rate-manager-dialog.component';
import { formatCurrency } from '../../../shared/utils/currency.util';

@Component({
  selector: 'app-fd-admin',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    PageHeaderComponent,
    DataTableComponent,
  ],
  templateUrl: './fd-admin.component.html',
  styleUrl: './fd-admin.component.scss',
})
export class FdAdminComponent implements OnInit {
  private readonly banksService = inject(FdBanksService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly loading = signal(true);
  readonly importing = signal(false);
  readonly banks = signal<FdBank[]>([]);
  readonly bankTypeLabels = FD_BANK_TYPE_LABELS;
  readonly importResult = signal<FdImportResult | null>(null);

  readonly columns: DataTableColumn<FdBank>[] = [
    { key: 'name', header: 'Bank', sortable: true },
    { key: 'bankType', header: 'Type', cell: (row) => this.bankTypeLabels[row.bankType] },
    { key: 'rating', header: 'Rating', sortable: true, cell: (row) => `${row.rating} ★` },
    { key: 'minDeposit', header: 'Min Deposit', cell: (row) => formatCurrency(row.minDeposit) },
    { key: 'isActive', header: 'Status', cell: (row) => (row.isActive ? 'Active' : 'Inactive') },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.banksService.list().subscribe({
      next: (banks) => {
        this.banks.set(banks);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(FdBankFormComponent, { width: '600px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Bank created.');
        this.load();
      }
    });
  }

  openEditDialog(bank: FdBank): void {
    const ref = this.dialog.open(FdBankFormComponent, { width: '600px', data: { bank } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Bank updated.');
        this.load();
      }
    });
  }

  manageRates(bank: FdBank): void {
    this.dialog.open(FdRateManagerDialogComponent, { width: '700px', data: { bank } });
  }

  deleteBank(bank: FdBank): void {
    this.confirmDialog
      .open({
        title: 'Delete bank',
        message: `Delete ${bank.name}? This removes all its rates and history.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.banksService.remove(bank.id).subscribe(() => {
          this.toast.success('Bank deleted.');
          this.load();
        });
      });
  }

  triggerImport(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importing.set(true);
    this.importResult.set(null);
    this.banksService.import(file).subscribe({
      next: (result) => {
        this.importing.set(false);
        this.importResult.set(result);
        this.toast.success(`Imported ${result.bankCount} banks, ${result.rateCount} rates.`);
        this.load();
        input.value = '';
      },
      error: (err) => {
        this.importing.set(false);
        this.toast.error(err?.error?.error?.message ?? 'Import failed.');
        input.value = '';
      },
    });
  }
}
