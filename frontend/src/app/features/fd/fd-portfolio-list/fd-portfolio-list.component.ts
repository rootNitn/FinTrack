import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { FdPortfolioService } from '../fd-portfolio.service';
import { FdPortfolioEntry, FdPortfolioSummary } from '../fd.model';
import { FdPortfolioFormComponent } from '../fd-portfolio-form/fd-portfolio-form.component';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-fd-portfolio-list',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, RouterLink, PageHeaderComponent, KpiCardComponent, DataTableComponent],
  templateUrl: './fd-portfolio-list.component.html',
  styleUrl: './fd-portfolio-list.component.scss',
})
export class FdPortfolioListComponent implements OnInit {
  private readonly portfolioService = inject(FdPortfolioService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly entries = signal<FdPortfolioEntry[]>([]);
  readonly summary = signal<FdPortfolioSummary | null>(null);
  readonly summaryLoading = signal(true);

  readonly columns: DataTableColumn<FdPortfolioEntry>[] = [
    { key: 'bankName', header: 'Bank', sortable: true },
    { key: 'amount', header: 'Amount', sortable: true, cell: (row) => currency(row.amount) },
    { key: 'interestRate', header: 'Rate', sortable: true, cell: (row) => `${row.interestRate}%` },
    { key: 'maturityDate', header: 'Maturity Date', sortable: true, cell: (row) => new Date(row.maturityDate).toLocaleDateString() },
    { key: 'maturityAmount', header: 'Maturity Amount', sortable: true, cell: (row) => currency(row.maturityAmount) },
    { key: 'status', header: 'Status' },
  ];

  ngOnInit(): void {
    this.load();
    this.loadSummary();
  }

  load(): void {
    this.loading.set(true);
    this.portfolioService.list().subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadSummary(): void {
    this.summaryLoading.set(true);
    this.portfolioService.getSummary().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.summaryLoading.set(false);
      },
      error: () => this.summaryLoading.set(false),
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(FdPortfolioFormComponent, { width: '520px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('FD added to your portfolio.');
        this.load();
        this.loadSummary();
      }
    });
  }

  openEditDialog(entry: FdPortfolioEntry): void {
    const ref = this.dialog.open(FdPortfolioFormComponent, { width: '520px', data: { entry } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('FD entry updated.');
        this.load();
        this.loadSummary();
      }
    });
  }

  deleteEntry(entry: FdPortfolioEntry): void {
    this.confirmDialog
      .open({
        title: 'Delete FD entry',
        message: `Remove the ${entry.bankName} FD from your portfolio? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.portfolioService.remove(entry.id).subscribe(() => {
          this.toast.success('FD entry deleted.');
          this.load();
          this.loadSummary();
        });
      });
  }

  currency(value: number): string {
    return currency(value);
  }
}
