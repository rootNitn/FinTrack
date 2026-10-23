import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { formatCurrency } from '../../shared/utils/currency.util';
import { formatDate } from '../../shared/utils/date.util';
import { UpcomingBillsService } from './upcoming-bills.service';
import { ToastService } from '../../core/services/toast.service';
import { UPCOMING_BILL_TYPE_ICONS, UPCOMING_BILL_TYPE_LABELS, UpcomingBillItem, UpcomingBillsResult } from './upcoming-bills.model';

const WINDOW_OPTIONS = [7, 30, 90];

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

function date(value: string): string {
  return formatDate(value);
}

@Component({
  selector: 'app-upcoming-bills',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatTooltipModule,
    PageHeaderComponent,
    KpiCardComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './upcoming-bills.component.html',
  styleUrl: './upcoming-bills.component.scss',
})
export class UpcomingBillsComponent implements OnInit {
  private readonly upcomingBillsService = inject(UpcomingBillsService);
  private readonly toast = inject(ToastService);

  readonly windowOptions = WINDOW_OPTIONS;
  readonly windowDays = signal(30);
  readonly loading = signal(true);
  readonly result = signal<UpcomingBillsResult | null>(null);

  readonly typeIcons = UPCOMING_BILL_TYPE_ICONS;
  readonly typeLabels = UPCOMING_BILL_TYPE_LABELS;

  readonly items = computed(() => this.result()?.items ?? []);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.upcomingBillsService.get(this.windowDays()).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onWindowChange(days: number): void {
    this.windowDays.set(days);
    this.load();
  }

  currency(value: number): string {
    return currency(value);
  }

  date(value: string): string {
    return date(value);
  }

  daysUntil(item: UpcomingBillItem): number {
    return item.daysRemaining;
  }

  markPaid(item: UpcomingBillItem): void {
    if (!window.confirm(`Mark "${item.title}" as paid?`)) return;
    this.upcomingBillsService.markPaid(item.id).subscribe({
      next: () => {
        this.toast.success('Bill marked as paid.');
        this.load();
      },
      error: () => this.toast.error('Unable to mark this bill as paid.'),
    });
  }

  snooze(item: UpcomingBillItem): void {
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + 7);
    this.upcomingBillsService.snooze(item.id, snoozedUntil.toISOString()).subscribe({
      next: () => {
        this.toast.success('Bill snoozed for 7 days.');
        this.load();
      },
      error: () => this.toast.error('Unable to snooze this bill.'),
    });
  }
}
