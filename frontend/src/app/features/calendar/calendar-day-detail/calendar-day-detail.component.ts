import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CalendarTransaction } from '../calendar.model';
import { formatCurrency as formatCurrencyUtil } from '../../../shared/utils/currency.util';

@Component({
  selector: 'app-calendar-day-detail',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  templateUrl: './calendar-day-detail.component.html',
  styleUrls: ['./calendar-day-detail.component.scss'],
})
export class CalendarDayDetailComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: {
      date: Date;
      transactions: CalendarTransaction[];
    }
  ) {}

  formatCurrency(amount: number): string {
    return formatCurrencyUtil(amount);
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      EXPENSE: 'Expense',
      INCOME: 'Income',
      INVESTMENT_BUY: 'Investment Buy',
      INVESTMENT_SELL: 'Investment Sell',
      SIP: 'SIP',
      TRANSFER: 'Transfer',
    };
    return labels[type] || type;
  }

  getTotalAmount(): number {
    return this.data.transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  getFormattedDate(): string {
    return this.data.date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
