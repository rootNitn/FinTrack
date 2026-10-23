import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CalendarService } from '../calendar.service';
import { CalendarTransaction, CalendarDataType } from '../calendar.model';
import { CalendarDayDetailComponent } from '../calendar-day-detail/calendar-day-detail.component';
import { formatCurrency } from '../../../shared/utils/currency.util';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponent implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly dialog = inject(MatDialog);
  protected readonly formatCurrency = formatCurrency;

  currentDate = new Date();
  monthName = '';
  yearName = '';
  daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  weeks: Date[][] = [];
  dayTransactions: Map<string, CalendarTransaction[]> = new Map();
  loading = true;
  error: string | null = null;

  // Filters
  showExpenses = true;
  showIncome = true;
  showInvestments = true;
  showSips = true;
  showTransfers = true;

  ngOnInit(): void {
    this.loadCalendar();
  }

  loadCalendar(): void {
    this.loading = true;
    this.error = null;
    this.updateMonthHeader();
    this.generateCalendarDays();
    this.loadTransactions();
  }

  updateMonthHeader(): void {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    this.monthName = monthNames[this.currentDate.getMonth()];
    this.yearName = this.currentDate.getFullYear().toString();
  }

  generateCalendarDays(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    this.weeks = [];
    let currentWeek: Date[] = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateToAdd = new Date(d);
      currentWeek.push(dateToAdd);

      if (currentWeek.length === 7) {
        this.weeks.push([...currentWeek]);
        currentWeek = [];
      }
    }
  }

  loadTransactions(): void {
    this.calendarService
      .getTransactionsForMonth(this.currentDate.getFullYear(), this.currentDate.getMonth())
      .subscribe({
        next: (transactions) => {
          this.dayTransactions.clear();

          transactions
            .filter((t) => this.shouldShowTransaction(t))
            .forEach((transaction) => {
              const dateKey = this.formatDateKey(new Date(transaction.date));
              if (!this.dayTransactions.has(dateKey)) {
                this.dayTransactions.set(dateKey, []);
              }
              this.dayTransactions.get(dateKey)!.push(transaction);
            });

          this.loading = false;
          this.error = null;
        },
        error: (err) => {
          console.error('Error loading calendar transactions:', err);
          this.loading = false;
          this.error = 'Failed to load transactions. Please try again.';
        },
      });
  }

  shouldShowTransaction(transaction: CalendarTransaction): boolean {
    const typeToFilterMap: Record<CalendarDataType, boolean> = {
      EXPENSE: this.showExpenses,
      INCOME: this.showIncome,
      INVESTMENT_BUY: this.showInvestments,
      INVESTMENT_SELL: this.showInvestments,
      SIP: this.showSips,
      TRANSFER: this.showTransfers,
    };
    return typeToFilterMap[transaction.type] ?? true;
  }

  previousMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.currentDate = new Date(this.currentDate);
    this.loadCalendar();
  }

  nextMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.currentDate = new Date(this.currentDate);
    this.loadCalendar();
  }

  isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.currentDate.getMonth();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  getTransactionsForDay(date: Date): CalendarTransaction[] {
    const dateKey = this.formatDateKey(date);
    return this.dayTransactions.get(dateKey) || [];
  }

  getTotalForDay(date: Date): number {
    return this.getTransactionsForDay(date).reduce((sum, t) => sum + t.amount, 0);
  }

  getDayClass(date: Date): string {
    const classes = ['calendar-day'];
    if (!this.isCurrentMonth(date)) classes.push('other-month');
    if (this.isToday(date)) classes.push('today');
    return classes.join(' ');
  }

  openDayDetail(date: Date): void {
    const transactions = this.getTransactionsForDay(date);
    if (transactions.length === 0) return;

    this.dialog.open(CalendarDayDetailComponent, {
      width: '500px',
      data: {
        date,
        transactions,
      },
    });
  }

  onFilterChange(): void {
    this.loadTransactions();
  }

  formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
