import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { ToastService } from '../../../core/services/toast.service';
import { FdRatesService } from '../fd-rates.service';
import { FdFavoritesService } from '../fd-favorites.service';
import { FdComparisonFilters, FdComparisonRow, FD_BANK_TYPE_LABELS, FdBankType } from '../fd.model';
import { FdCompareDialogComponent } from '../fd-compare-dialog/fd-compare-dialog.component';

const TENURE_OPTIONS = [
  { label: '7 - 45 Days', days: 30 },
  { label: '46 - 179 Days', days: 120 },
  { label: '180 Days - 1 Year', days: 270 },
  { label: '1 Year', days: 365 },
  { label: '2 Years', days: 730 },
  { label: '3 Years', days: 1095 },
  { label: '5 Years', days: 1825 },
];

import { formatCurrency } from '../../../shared/utils/currency.util';

const MAX_COMPARE = 5;

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-fd-comparison',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTooltipModule,
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    SkeletonLoaderComponent,
  ],
  templateUrl: './fd-comparison.component.html',
  styleUrl: './fd-comparison.component.scss',
})
export class FdComparisonComponent implements OnInit {
  private readonly ratesService = inject(FdRatesService);
  private readonly favoritesService = inject(FdFavoritesService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  readonly tenureOptions = TENURE_OPTIONS;
  readonly bankTypeLabels = FD_BANK_TYPE_LABELS;
  readonly bankTypes = Object.keys(FD_BANK_TYPE_LABELS) as FdBankType[];

  readonly loading = signal(true);
  readonly rows = signal<FdComparisonRow[]>([]);
  readonly favoriteBankIds = signal<Set<string>>(new Set());
  readonly selectedBankIds = signal<Set<string>>(new Set());

  readonly amount = signal(100000);
  readonly tenureDays = signal(365);
  readonly fdType = signal<'REGULAR' | 'SENIOR'>('REGULAR');
  readonly selectedBankTypes = signal<Set<FdBankType>>(new Set());
  readonly minRating = signal(0);
  readonly search = signal('');
  readonly sortBy = signal<FdComparisonFilters['sortBy']>('maturityAmount');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  readonly selectedCount = computed(() => this.selectedBankIds().size);

  ngOnInit(): void {
    this.load();
    this.favoritesService.list().subscribe((favorites) => {
      this.favoriteBankIds.set(new Set(favorites.map((f) => f.bankId)));
    });
  }

  private currentFilters(): FdComparisonFilters {
    const bankTypes = Array.from(this.selectedBankTypes());
    return {
      amount: this.amount(),
      tenureDays: this.tenureDays(),
      fdType: this.fdType(),
      bankTypes: bankTypes.length ? bankTypes.join(',') : undefined,
      minRating: this.minRating() || undefined,
      search: this.search() || undefined,
      sortBy: this.sortBy(),
      sortDir: this.sortDir(),
    };
  }

  load(): void {
    this.loading.set(true);
    this.ratesService.compare(this.currentFilters()).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleBankType(type: FdBankType): void {
    const current = new Set(this.selectedBankTypes());
    if (current.has(type)) current.delete(type);
    else current.add(type);
    this.selectedBankTypes.set(current);
    this.load();
  }

  sortByColumn(column: NonNullable<FdComparisonFilters['sortBy']>): void {
    if (this.sortBy() === column) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDir.set('desc');
    }
    this.load();
  }

  toggleSelected(bankId: string): void {
    const current = new Set(this.selectedBankIds());
    if (current.has(bankId)) {
      current.delete(bankId);
    } else {
      if (current.size >= MAX_COMPARE) {
        this.toast.error(`You can compare up to ${MAX_COMPARE} banks at a time.`);
        return;
      }
      current.add(bankId);
    }
    this.selectedBankIds.set(current);
  }

  isSelected(bankId: string): boolean {
    return this.selectedBankIds().has(bankId);
  }

  openCompareDialog(): void {
    const selected = this.rows().filter((r) => this.selectedBankIds().has(r.bankId));
    this.dialog.open(FdCompareDialogComponent, { width: '90vw', maxWidth: '1000px', data: { rows: selected } });
  }

  toggleFavorite(bankId: string): void {
    const current = new Set(this.favoriteBankIds());
    if (current.has(bankId)) {
      this.favoritesService.remove(bankId).subscribe(() => {
        current.delete(bankId);
        this.favoriteBankIds.set(new Set(current));
      });
    } else {
      this.favoritesService.add(bankId).subscribe(() => {
        current.add(bankId);
        this.favoriteBankIds.set(new Set(current));
      });
    }
  }

  isFavorite(bankId: string): boolean {
    return this.favoriteBankIds().has(bankId);
  }

  exportExcel(): void {
    this.ratesService.exportExcel(this.currentFilters());
  }

  exportPdf(): void {
    this.ratesService.exportPdf(this.currentFilters());
  }

  print(): void {
    window.print();
  }

  share(): void {
    const top = this.rows()[0];
    if (!top) return;
    const summary = `${top.bankName} offers ${top.interestRate}% for ${top.tenureLabel} — ₹${this.amount().toLocaleString('en-IN')} grows to ${currency(top.maturityAmount)}.`;
    navigator.clipboard?.writeText(summary).then(
      () => this.toast.success('Comparison summary copied to clipboard.'),
      () => this.toast.error('Could not copy to clipboard.')
    );
  }

  currency(value: number): string {
    return currency(value);
  }
}
