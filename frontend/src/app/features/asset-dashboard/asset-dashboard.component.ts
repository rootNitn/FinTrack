import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../shared/utils/currency.util';
import { formatPercent } from '../../shared/utils/percent.util';
import { Investment, InvestmentCategory } from '../investments/investments.model';
import { InvestmentsService } from '../investments/investments.service';

@Component({
  selector: 'app-asset-dashboard',
  imports: [CommonModule, MatButtonModule, MatIconModule, PageHeaderComponent, EmptyStateComponent, SkeletonLoaderComponent],
  templateUrl: './asset-dashboard.component.html',
})
export class AssetDashboardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly investmentsService = inject(InvestmentsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly investments = signal<Investment[]>([]);
  readonly category = signal<InvestmentCategory>('STOCKS');

  get title(): string {
    return this.category() === 'CRYPTO' ? 'Crypto' : 'Stocks';
  }

  get icon(): string {
    return this.category() === 'CRYPTO' ? 'currency_bitcoin' : 'show_chart';
  }

  get totalInvested(): number {
    return this.investments().reduce((sum, item) => sum + item.principalAmount, 0);
  }

  get currentValue(): number {
    return this.investments().reduce((sum, item) => sum + item.currentValue, 0);
  }

  get totalProfit(): number {
    return this.currentValue - this.totalInvested;
  }

  get totalRoi(): number {
    return this.totalInvested > 0 ? (this.totalProfit / this.totalInvested) * 100 : 0;
  }

  ngOnInit(): void {
    const category = this.route.snapshot.data['category'] as InvestmentCategory | undefined;
    if (category === 'STOCKS' || category === 'CRYPTO') this.category.set(category);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.investmentsService.list({ category: this.category(), limit: 100, sortBy: 'currentValue', sortDir: 'desc' }).subscribe({
      next: (result) => {
        this.investments.set(result.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(`Failed to load ${this.title} dashboard.`);
      },
    });
  }

  refreshPrices(): void {
    this.investmentsService.refreshPrices().subscribe({
      next: () => {
        this.toast.success('Prices refreshed.');
        this.load();
      },
      error: () => this.toast.error('Failed to refresh prices.'),
    });
  }

  currency(value: number): string {
    return formatCurrency(value, { maximumFractionDigits: 0 });
  }

  percent(value: number): string {
    return formatPercent(value, { signed: true });
  }
}