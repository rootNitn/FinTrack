import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { formatCurrency } from '../../shared/utils/currency.util';
import { UpcomingBillsService } from './upcoming-bills.service';
import { UPCOMING_BILL_TYPE_ICONS, UPCOMING_BILL_TYPE_LABELS, UpcomingBillItem, UpcomingBillsResult } from './upcoming-bills.model';

const WINDOW_OPTIONS = [7, 30, 90];

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

function date(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

@Component({
  selector: 'app-upcoming-bills',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonToggleModule,
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
    const diff = new Date(item.dueDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}
