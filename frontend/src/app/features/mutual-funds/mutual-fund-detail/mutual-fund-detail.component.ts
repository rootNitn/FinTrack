import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { formatPercent as formatPercentShared } from '../../../shared/utils/percent.util';
import { formatDate } from '../../../shared/utils/date.util';
import { MutualFundsService } from '../mutual-funds.service';
import {
  MUTUAL_FUND_RATING_CLASSES,
  MUTUAL_FUND_RATING_LABELS,
  MutualFundDetail,
} from '../mutual-funds.model';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

const RECURRENCE_LABELS: Record<string, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

@Component({
  selector: 'app-mutual-fund-detail',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    PageHeaderComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './mutual-fund-detail.component.html',
})
export class MutualFundDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly mutualFundsService = inject(MutualFundsService);

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly fund = signal<MutualFundDetail | null>(null);

  readonly ratingLabels = MUTUAL_FUND_RATING_LABELS;
  readonly ratingClasses = MUTUAL_FUND_RATING_CLASSES;

  readonly sipLabel = computed(() => {
    const info = this.fund()?.sipInfo;
    if (!info) return null;
    const interval = info.recurrenceInterval ? RECURRENCE_LABELS[info.recurrenceInterval] ?? info.recurrenceInterval : '';
    return `${interval} SIP · ${info.installmentCount} installment${info.installmentCount === 1 ? '' : 's'} so far`;
  });

  ngOnInit(): void {
    const key = this.route.snapshot.paramMap.get('key');
    if (!key) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.mutualFundsService.getFundDetail(key).subscribe({
      next: (detail) => {
        this.loading.set(false);
        this.fund.set(detail);
      },
      error: () => {
        this.loading.set(false);
        this.notFound.set(true);
      },
    });
  }

  currency(value: number): string {
    return currency(value);
  }

  formatPercent(value: number | null): string {
    return formatPercentShared(value, { signed: true });
  }

  formatDate(value: string | null): string {
    return value ? formatDate(value) : '—';
  }
}
