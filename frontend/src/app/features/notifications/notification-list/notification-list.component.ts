import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppNotification, NotificationType } from '../notifications.model';
import { NotificationsService } from '../notifications.service';

const TYPE_ICONS: Record<NotificationType, string> = {
  FD_MATURITY: 'savings',
  SIP_REMINDER: 'event_repeat',
  GOAL_ACHIEVEMENT: 'emoji_events',
  MONTHLY_SUMMARY: 'summarize',
  LARGE_EXPENSE_ALERT: 'warning',
  FD_RATE_CHANGE: 'trending_up',
  HIGHER_FD_RATE_AVAILABLE: 'percent',
  FD_RENEWAL_REMINDER: 'event_repeat',
  CC_PAYMENT_DUE: 'credit_card',
  EMI_DUE: 'account_balance',
  BUDGET_EXCEEDED: 'report_problem',
  INSURANCE_RENEWAL: 'shield',
  BIRTHDAY_REMINDER: 'cake',
  SYSTEM: 'info',
};

@Component({
  selector: 'app-notification-list',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSlideToggleModule,
    PageHeaderComponent,
    EmptyStateComponent,
    SkeletonLoaderComponent,
  ],
  templateUrl: './notification-list.component.html',
  styleUrl: './notification-list.component.scss',
})
export class NotificationListComponent {
  private readonly notificationsService = inject(NotificationsService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadOnly = signal(false);

  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.isRead).length);

  constructor() {
    this.load();
  }

  iconFor(type: NotificationType): string {
    return TYPE_ICONS[type] ?? 'notifications';
  }

  timeAgo(value: string): string {
    return new Date(value).toLocaleString();
  }

  load(): void {
    this.loading.set(true);
    this.notificationsService.list(this.unreadOnly()).subscribe({
      next: (notifications) => {
        this.notifications.set(notifications);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleUnreadOnly(): void {
    this.unreadOnly.set(!this.unreadOnly());
    this.load();
  }

  markRead(notification: AppNotification): void {
    if (notification.isRead) return;
    this.notificationsService.markRead(notification.id).subscribe(() => this.load());
  }

  markAllRead(): void {
    this.notificationsService.markAllRead().subscribe(() => {
      this.toast.success('All notifications marked as read.');
      this.load();
    });
  }

  remove(notification: AppNotification): void {
    this.confirmDialog
      .open({
        title: 'Delete notification',
        message: 'Are you sure you want to delete this notification?',
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.notificationsService.remove(notification.id).subscribe(() => {
          this.toast.success('Notification deleted.');
          this.load();
        });
      });
  }
}
