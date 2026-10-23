import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { DataTableComponent, DataTableColumn } from '../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { formatCurrency } from '../../shared/utils/currency.util';
import { AdminService } from './admin.service';
import { AdminAnalytics, AdminUser, AuditLogEntry } from './admin.model';
import { formatDateTime } from '../../shared/utils/date.util';
import { ListFilterBarComponent } from '../../shared/components/list-filter-bar/list-filter-bar.component';

function dateTime(value: string): string {
  return formatDateTime(value);
}

@Component({
  selector: 'app-admin',
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    PageHeaderComponent,
    KpiCardComponent,
    DataTableComponent,
    ListFilterBarComponent,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);

  readonly currentUserId = this.authService.currentUser()?.id;

  readonly analyticsLoading = signal(true);
  readonly analytics = signal<AdminAnalytics | null>(null);

  readonly usersLoading = signal(true);
  readonly users = signal<AdminUser[]>([]);
  readonly usersTotal = signal(0);
  readonly usersPageIndex = signal(0);
  readonly usersPageSize = signal(10);
  readonly usersSearch = signal('');
  readonly activeFilterCount = signal(0);

  readonly auditLoading = signal(true);
  readonly auditLogs = signal<AuditLogEntry[]>([]);
  readonly auditTotal = signal(0);
  readonly auditPageIndex = signal(0);
  readonly auditPageSize = signal(10);

  readonly userColumns: DataTableColumn<AdminUser>[] = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role' },
    { key: 'isActive', header: 'Status', cell: (row) => (row.isActive ? 'Active' : 'Inactive') },
    { key: 'createdAt', header: 'Joined', cell: (row) => dateTime(row.createdAt) },
  ];

  readonly auditColumns: DataTableColumn<AuditLogEntry>[] = [
    { key: 'createdAt', header: 'When', cell: (row) => dateTime(row.createdAt) },
    { key: 'action', header: 'Action' },
    { key: 'entity', header: 'Entity' },
    { key: 'entityId', header: 'Entity ID', cell: (row) => row.entityId ?? '—' },
    { key: 'userId', header: 'User ID', cell: (row) => row.userId ?? 'system' },
  ];

  ngOnInit(): void {
    this.loadAnalytics();
    this.loadUsers();
    this.loadAuditLogs();
  }

  loadAnalytics(): void {
    this.analyticsLoading.set(true);
    this.adminService.getAnalytics().subscribe({
      next: (data) => {
        this.analytics.set(data);
        this.analyticsLoading.set(false);
      },
      error: () => this.analyticsLoading.set(false),
    });
  }

  loadUsers(): void {
    this.usersLoading.set(true);
    this.adminService
      .listUsers({ page: this.usersPageIndex() + 1, limit: this.usersPageSize(), search: this.usersSearch() || undefined })
      .subscribe({
        next: ({ data, meta }) => {
          this.users.set(data);
          this.usersTotal.set(meta?.total ?? data.length);
          this.usersLoading.set(false);
        },
        error: () => this.usersLoading.set(false),
      });
  }

  loadAuditLogs(): void {
    this.auditLoading.set(true);
    this.adminService
      .listAuditLogs({ page: this.auditPageIndex() + 1, limit: this.auditPageSize() })
      .subscribe({
        next: ({ data, meta }) => {
          this.auditLogs.set(data);
          this.auditTotal.set(meta?.total ?? data.length);
          this.auditLoading.set(false);
        },
        error: () => this.auditLoading.set(false),
      });
  }

  onUsersPage(event: PageEvent): void {
    this.usersPageIndex.set(event.pageIndex);
    this.usersPageSize.set(event.pageSize);
    this.loadUsers();
  }

  onUsersSearch(value: string): void {
    this.usersSearch.set(value);
    this.activeFilterCount.set(Number(!!value.trim()));
    this.usersPageIndex.set(0);
    this.loadUsers();
  }

  clearFilters(): void {
    this.usersSearch.set('');
    this.activeFilterCount.set(0);
    this.usersPageIndex.set(0);
    this.loadUsers();
  }

  onAuditPage(event: PageEvent): void {
    this.auditPageIndex.set(event.pageIndex);
    this.auditPageSize.set(event.pageSize);
    this.loadAuditLogs();
  }

  toggleActive(user: AdminUser): void {
    const nextState = !user.isActive;
    this.confirmDialog
      .open({
        title: nextState ? 'Activate user' : 'Deactivate user',
        message: `${nextState ? 'Activate' : 'Deactivate'} ${user.name} (${user.email})?`,
        confirmLabel: nextState ? 'Activate' : 'Deactivate',
        danger: !nextState,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.adminService.setUserActive(user.id, nextState).subscribe({
          next: () => {
            this.toast.success(`User ${nextState ? 'activated' : 'deactivated'}.`);
            this.loadUsers();
          },
          error: () => this.toast.error('Failed to update user status.'),
        });
      });
  }

  toggleRole(user: AdminUser): void {
    const nextRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    this.confirmDialog
      .open({
        title: 'Change role',
        message: `Change ${user.name}'s role to ${nextRole}?`,
        confirmLabel: 'Change role',
        danger: nextRole === 'ADMIN',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.adminService.setUserRole(user.id, nextRole).subscribe({
          next: () => {
            this.toast.success(`Role updated to ${nextRole}.`);
            this.loadUsers();
          },
          error: () => this.toast.error('Failed to update user role.'),
        });
      });
  }

  currency(value: number): string {
    return formatCurrency(value, { maximumFractionDigits: 0 });
  }
}
