import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../shared/utils/currency.util';
import { FinancialLevelService } from './financial-level.service';
import { FinancialLevelSummary } from './financial-level.model';

@Component({
  selector: 'app-financial-level',
  imports: [CommonModule, RouterLink, MatIconModule, PageHeaderComponent, SkeletonLoaderComponent],
  templateUrl: './financial-level.component.html',
  styleUrl: './financial-level.component.scss',
})
export class FinancialLevelComponent implements OnInit {
  private readonly service = inject(FinancialLevelService);
  private readonly toast = inject(ToastService);
  readonly loading = signal(true);
  readonly summary = signal<FinancialLevelSummary | null>(null);

  ngOnInit(): void {
    this.service.getSummary().subscribe({
      next: (result) => { this.summary.set(result); this.loading.set(false); },
      error: (err) => { this.loading.set(false); this.toast.error(err?.error?.error?.message ?? 'Failed to load financial progression.'); },
    });
  }

  money(value: number | null): string { return value === null ? 'No data' : formatCurrency(value, { maximumFractionDigits: 0 }); }
  percent(value: number | null): string { return value === null ? 'No data' : `${value}%`; }
  levelIndex(label: string): number { return ['Financially Vulnerable', 'Financially Stable', 'Financially Secure', 'Financially Strong', 'Financially Independent', 'Financially Wealthy'].indexOf(label); }
}
