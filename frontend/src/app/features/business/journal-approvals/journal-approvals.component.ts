import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { formatDate } from '../../../shared/utils/date.util';
import { BusinessJournalEntry } from '../business.model';
import { BusinessService } from '../business.service';

@Component({
  selector: 'app-journal-approvals',
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatIconModule, PageHeaderComponent],
  templateUrl: './journal-approvals.component.html',
})
export class JournalApprovalsComponent {
  private readonly service = inject(BusinessService);
  private readonly toast = inject(ToastService);

  readonly entries = signal<BusinessJournalEntry[]>([]);
  readonly loading = signal(true);
  readonly rejectionReasons = signal<Record<string, string>>({});

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.pendingJournalApprovals().subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.error(error?.error?.error?.message ?? 'Could not load pending journals.');
      },
    });
  }

  setReason(id: string, value: string): void {
    this.rejectionReasons.update((reasons) => ({ ...reasons, [id]: value }));
  }

  approve(entry: BusinessJournalEntry): void {
    this.service.approveJournalEntry(entry.id).subscribe({
      next: () => {
        this.toast.success('Journal entry approved and posted.');
        this.load();
      },
      error: (error) => this.toast.error(error?.error?.error?.message ?? 'Could not approve the journal entry.'),
    });
  }

  reject(entry: BusinessJournalEntry): void {
    const reason = this.rejectionReasons()[entry.id]?.trim();
    if (!reason) {
      this.toast.error('Enter a reason before rejecting this journal.');
      return;
    }
    this.service.rejectJournalEntry(entry.id, reason).subscribe({
      next: () => {
        this.toast.success('Journal entry rejected.');
        this.load();
      },
      error: (error) => this.toast.error(error?.error?.error?.message ?? 'Could not reject the journal entry.'),
    });
  }

  amount(value: number | string): string {
    return formatCurrency(Number(value));
  }

  date(value: string): string {
    return formatDate(value);
  }
}