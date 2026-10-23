import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { CARD_NETWORK_LABELS, CreditCard, CreditCardSummary } from '../credit-cards.model';
import { CreditCardsService } from '../credit-cards.service';
import { CreditCardFormComponent } from '../credit-card-form/credit-card-form.component';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { FamilyMember } from '../../family-members/family-members.model';
import { FamilyMembersService } from '../../family-members/family-members.service';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-credit-card-list',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    PageHeaderComponent,
    KpiCardComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './credit-card-list.component.html',
  styleUrl: './credit-card-list.component.scss',
})
export class CreditCardListComponent {
  private readonly creditCardsService = inject(CreditCardsService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly familyMembersService = inject(FamilyMembersService);

  readonly networkLabels = CARD_NETWORK_LABELS;
  readonly loading = signal(true);
  readonly summaryLoading = signal(true);
  readonly cards = signal<CreditCard[]>([]);
  readonly summary = signal<CreditCardSummary | null>(null);
  readonly familyMembers = signal<FamilyMember[]>([]);
  readonly selectedFamilyMemberId = signal('');

  constructor() {
    this.load();
    this.familyMembersService.list().subscribe((members) => this.familyMembers.set(members));
  }

  load(): void {
    this.loading.set(true);
    this.summaryLoading.set(true);

    this.creditCardsService.list(this.selectedFamilyMemberId() || undefined).subscribe({
      next: (cards) => {
        this.cards.set(cards);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.creditCardsService.summary().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.summaryLoading.set(false);
      },
      error: () => this.summaryLoading.set(false),
    });
  }

  onFamilyMemberFilterChange(): void {
    this.load();
  }

  currency(value: number): string {
    return currency(value);
  }

  utilizationBarColor(level: string): string {
    switch (level) {
      case 'CRITICAL':
        return 'bg-loss';
      case 'HIGH':
        return 'bg-amber-500';
      case 'MODERATE':
        return 'bg-yellow-400';
      default:
        return 'bg-profit';
    }
  }

  viewDetail(card: CreditCard): void {
    this.router.navigate(['/credit-cards', card.id]);
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(CreditCardFormComponent, { width: '640px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Credit card added.');
        this.load();
      }
    });
  }

  openEditDialog(card: CreditCard, event: Event): void {
    event.stopPropagation();
    const ref = this.dialog.open(CreditCardFormComponent, { width: '640px', data: { card } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Credit card updated.');
        this.load();
      }
    });
  }

  deleteCard(card: CreditCard, event: Event): void {
    event.stopPropagation();
    this.confirmDialog
      .open({
        title: 'Delete credit card',
        message: `Are you sure you want to delete "${card.cardName}"? This will also delete its statements and payment history.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.creditCardsService.remove(card.id).subscribe(() => {
          this.toast.success('Credit card deleted.');
          this.load();
        });
      });
  }
}
