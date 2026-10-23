import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { CARD_NETWORK_LABELS, CreditCardDetail, CreditCardPayment, CreditCardStatement, STATEMENT_STATUS_LABELS } from '../credit-cards.model';
import { CreditCardsService } from '../credit-cards.service';
import { CreditCardFormComponent } from '../credit-card-form/credit-card-form.component';
import { StatementFormComponent } from '../statement-form/statement-form.component';
import { PaymentFormComponent } from '../payment-form/payment-form.component';
import { RedeemDialogComponent } from '../redeem-dialog/redeem-dialog.component';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { formatDate } from '../../../shared/utils/date.util';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

function date(value: string): string {
  return formatDate(value);
}

@Component({
  selector: 'app-credit-card-detail',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    PageHeaderComponent,
    KpiCardComponent,
    DataTableComponent,
  ],
  templateUrl: './credit-card-detail.component.html',
  styleUrl: './credit-card-detail.component.scss',
})
export class CreditCardDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly creditCardsService = inject(CreditCardsService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly networkLabels = CARD_NETWORK_LABELS;
  readonly statusLabels = STATEMENT_STATUS_LABELS;
  readonly loading = signal(true);
  readonly card = signal<CreditCardDetail | null>(null);
  private readonly cardId = this.route.snapshot.paramMap.get('id')!;

  readonly statementColumns: DataTableColumn<CreditCardStatement>[] = [
    { key: 'period', header: 'Period', cell: (row) => `${row.month}/${row.year}` },
    { key: 'statementDate', header: 'Statement Date', cell: (row) => date(row.statementDate) },
    { key: 'dueDate', header: 'Due Date', cell: (row) => date(row.dueDate) },
    { key: 'totalDue', header: 'Total Due', cell: (row) => currency(row.totalDue) },
    { key: 'minimumDue', header: 'Minimum Due', cell: (row) => currency(row.minimumDue) },
    { key: 'amountDue', header: 'Amount Due', cell: (row) => currency(row.amountDue) },
    { key: 'paidAmount', header: 'Paid', cell: (row) => currency(row.paidAmount) },
    { key: 'status', header: 'Status', cell: (row) => this.statusLabels[row.status] },
  ];

  readonly paymentColumns: DataTableColumn<CreditCardPayment>[] = [
    { key: 'paidDate', header: 'Date', cell: (row) => date(row.paidDate) },
    { key: 'amount', header: 'Amount', cell: (row) => currency(row.amount) },
    { key: 'method', header: 'Method', cell: (row) => row.method ?? '—' },
    { key: 'notes', header: 'Notes', cell: (row) => row.notes ?? '—' },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.creditCardsService.getById(this.cardId).subscribe({
      next: (card) => {
        this.card.set(card);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  currency(value: number): string {
    return currency(value);
  }

  formatDate(value: string): string {
    return date(value);
  }

  goBack(): void {
    this.router.navigate(['/credit-cards']);
  }

  openEditDialog(): void {
    const c = this.card();
    if (!c) return;
    const ref = this.dialog.open(CreditCardFormComponent, { width: '640px', data: { card: c } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Credit card updated.');
        this.load();
      }
    });
  }

  deleteCard(): void {
    const c = this.card();
    if (!c) return;
    this.confirmDialog
      .open({
        title: 'Delete credit card',
        message: `Are you sure you want to delete "${c.cardName}"? This will also delete its statements and payment history.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.creditCardsService.remove(c.id).subscribe(() => {
          this.toast.success('Credit card deleted.');
          this.router.navigate(['/credit-cards']);
        });
      });
  }

  openAddStatementDialog(): void {
    const ref = this.dialog.open(StatementFormComponent, { width: '640px', data: { cardId: this.cardId } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Statement added.');
        this.load();
      }
    });
  }

  openRecordPaymentDialog(): void {
    const c = this.card();
    if (!c) return;
    const ref = this.dialog.open(PaymentFormComponent, { width: '520px', data: { cardId: this.cardId, statements: c.statements } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Payment recorded.');
        this.load();
      }
    });
  }

  openRedeemDialog(): void {
    const c = this.card();
    if (!c) return;
    const ref = this.dialog.open(RedeemDialogComponent, { width: '420px', data: { card: c } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Redeemed successfully.');
        this.load();
      }
    });
  }
}
