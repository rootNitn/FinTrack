import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ToastService } from '../../../core/services/toast.service';
import {
  SupportTicket,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  TICKET_TYPE_LABELS,
  TICKET_TYPES,
  TicketStatus,
  TicketType,
} from '../../support-tickets/support-tickets.model';
import { SupportTicketsService } from '../../support-tickets/support-tickets.service';
import { TicketRespondDialogComponent } from './ticket-respond-dialog/ticket-respond-dialog.component';
import { formatDate } from '../../../shared/utils/date.util';
import { ListFilterBarComponent } from '../../../shared/components/list-filter-bar/list-filter-bar.component';

@Component({
  selector: 'app-support-tickets-admin',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    PageHeaderComponent,
    DataTableComponent,
    ListFilterBarComponent,
  ],
  templateUrl: './support-tickets-admin.component.html',
  styleUrl: './support-tickets-admin.component.scss',
})
export class SupportTicketsAdminComponent {
  private readonly ticketsService = inject(SupportTicketsService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly tickets = signal<SupportTicket[]>([]);
  readonly typeFilter = signal<TicketType | ''>('');
  readonly statusFilter = signal<TicketStatus | ''>('');
  readonly activeFilterCount = signal(0);

  readonly ticketTypes = TICKET_TYPES;
  readonly ticketStatuses = TICKET_STATUSES;
  readonly typeLabels = TICKET_TYPE_LABELS;
  readonly statusLabels = TICKET_STATUS_LABELS;

  readonly columns: DataTableColumn<SupportTicket>[] = [
    { key: 'subject', header: 'Subject', sortable: true, cell: (row) => row.subject },
    { key: 'user', header: 'User', cell: (row) => row.user?.name ?? '—' },
    { key: 'type', header: 'Type', cell: (row) => this.typeLabels[row.type] },
    { key: 'status', header: 'Status', cell: (row) => this.statusLabels[row.status] },
    { key: 'createdAt', header: 'Raised', sortable: true, cell: (row) => formatDate(row.createdAt) },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.ticketsService
      .listAll({
        limit: 100,
        ...(this.typeFilter() ? { type: this.typeFilter() as TicketType } : {}),
        ...(this.statusFilter() ? { status: this.statusFilter() as TicketStatus } : {}),
      })
      .subscribe({
        next: ({ data }) => {
          this.tickets.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onFilterChange(): void {
    this.activeFilterCount.set(Number(!!this.typeFilter()) + Number(!!this.statusFilter()));
    this.load();
  }

  clearFilters(): void {
    this.typeFilter.set('');
    this.statusFilter.set('');
    this.activeFilterCount.set(0);
    this.load();
  }

  respond(ticket: SupportTicket): void {
    const ref = this.dialog.open(TicketRespondDialogComponent, { width: '600px', data: { ticket } });
    ref.afterClosed().subscribe((updated) => {
      if (updated) {
        this.toast.success('Ticket updated.');
        this.load();
      }
    });
  }
}
