import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { BankAccount } from '../banks.model';
import { BanksService } from '../banks.service';
import { BankFormComponent } from '../bank-form/bank-form.component';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value);
}

@Component({
  selector: 'app-bank-list',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, PageHeaderComponent, DataTableComponent],
  templateUrl: './bank-list.component.html',
  styleUrl: './bank-list.component.scss'
})
export class BankListComponent {
  private readonly banksService = inject(BanksService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly accounts = signal<BankAccount[]>([]);

  readonly columns: DataTableColumn<BankAccount>[] = [
    { key: 'bankName', header: 'Bank Name', sortable: true },
    { key: 'accountType', header: 'Type', sortable: true },
    { key: 'accountNumber', header: 'Account Number' },
    { key: 'ifsc', header: 'IFSC' },
    { key: 'balance', header: 'Balance', sortable: true, cell: (row) => currency(row.balance) },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.banksService.list().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(BankFormComponent, { width: '600px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Bank account added.');
        this.load();
      }
    });
  }

  openEditDialog(account: BankAccount): void {
    const ref = this.dialog.open(BankFormComponent, { width: '600px', data: { account } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Bank account updated.');
        this.load();
      }
    });
  }

  deleteAccount(account: BankAccount): void {
    this.confirmDialog
      .open({
        title: 'Delete bank account',
        message: `Are you sure you want to delete "${account.bankName}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.banksService.remove(account.id).subscribe(() => {
          this.toast.success('Bank account deleted.');
          this.load();
        });
      });
  }

}
