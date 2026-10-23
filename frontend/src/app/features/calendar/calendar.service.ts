import { inject, Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiBaseService } from '../../core/services/api-base.service';
import { CalendarTransaction, CalendarDataType } from './calendar.model';

interface CalendarExpenseRow {
  id: string;
  amount: number;
  date: string;
  description?: string;
  category?: string;
}

interface CalendarIncomeRow {
  id: string;
  amount: number;
  date: string;
  description?: string;
  source?: string;
}

interface CalendarLedgerRow {
  id: string;
  type: string;
  amount: number;
  date: string;
  description?: string;
  category?: string;
}

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly api = inject(ApiBaseService);

  getTransactionsForMonth(year: number, month: number): Observable<CalendarTransaction[]> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    
    const fromStr = startDate.toISOString().split('T')[0];
    const toStr = endDate.toISOString().split('T')[0];

    // Fetch expenses
    const expenses$ = this.api
      .getWithMeta<CalendarExpenseRow[]>('/expenses', {
        from: fromStr,
        to: toStr,
      })
      .pipe(
        map((response) =>
          (response.data || []).map((e) => ({
            id: e.id,
            type: 'EXPENSE' as CalendarDataType,
            amount: -e.amount, // negative for expenses
            date: e.date,
            description: e.description,
            category: e.category,
            color: '#F44336', // red for expenses
          }))
        ),
        catchError((err) => {
          console.warn('Failed to load expenses:', err);
          return of([]);
        })
      );

    // Fetch income
    const income$ = this.api
      .getWithMeta<CalendarIncomeRow[]>('/income', {
        from: fromStr,
        to: toStr,
      })
      .pipe(
        map((response) =>
          (response.data || []).map((i) => ({
            id: i.id,
            type: 'INCOME' as CalendarDataType,
            amount: i.amount,
            date: i.date,
            description: i.description,
            category: i.source,
            color: '#4CAF50', // green for income
          }))
        ),
        catchError((err) => {
          console.warn('Failed to load income:', err);
          return of([]);
        })
      );

    // Fetch transactions
    const transactions$ = this.api
      .getWithMeta<CalendarLedgerRow[]>('/transactions', {
        from: fromStr,
        to: toStr,
      })
      .pipe(
        map((response) =>
          (response.data || [])
            .filter(
              (t) =>
                t.type === 'INVESTMENT_BUY' ||
                t.type === 'INVESTMENT_SELL' ||
                t.type === 'SIP' ||
                t.type === 'TRANSFER'
            )
            .map((t) => ({
              id: t.id,
              type: t.type as CalendarDataType,
              amount: t.type === 'INVESTMENT_SELL' || t.type === 'TRANSFER' ? t.amount : -t.amount,
              date: t.date,
              description: t.description,
              category: t.category,
              color: this.getColorByType(t.type),
            }))
        ),
        catchError((err) => {
          console.warn('Failed to load transactions:', err);
          return of([]);
        })
      );

    return forkJoin([expenses$, income$, transactions$]).pipe(
      map((results) => {
        const all = results.flat();
        return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }),
      catchError((err) => {
        console.error('Error loading calendar data:', err);
        return of([]);
      })
    );
  }

  private getColorByType(type: string): string {
    const colorMap: Record<string, string> = {
      INVESTMENT_BUY: '#2196F3',
      INVESTMENT_SELL: '#FF9800',
      SIP: '#9C27B0',
      TRANSFER: '#00BCD4',
    };
    return colorMap[type] || '#666';
  }
}
