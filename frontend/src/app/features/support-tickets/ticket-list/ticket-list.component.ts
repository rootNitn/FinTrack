import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ToastService } from '../../../core/services/toast.service';
import { SupportTicket, TICKET_STATUS_LABELS, TICKET_TYPE_ICONS, TICKET_TYPE_LABELS } from '../support-tickets.model';
import { SupportTicketsService } from '../support-tickets.service';
import { TicketFormComponent } from '../ticket-form/ticket-form.component';
import { TicketDetailComponent } from '../ticket-detail/ticket-detail.component';

@Component({
  selector: 'app-ticket-list',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, MatChipsModule, PageHeaderComponent, DataTableComponent],
  templateUrl: './ticket-list.component.html',
  styleUrl: './ticket-list.component.scss',
})
export class TicketListComponent {
  private readonly ticketsService = inject(SupportTicketsService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly tickets = signal<SupportTicket[]>([]);

  readonly typeLabels = TICKET_TYPE_LABELS;
  readonly typeIcons = TICKET_TYPE_ICONS;
  readonly statusLabels = TICKET_STATUS_LABELS;

  readonly columns: DataTableColumn<SupportTicket>[] = [
    { key: 'subject', header: 'Subject', sortable: true, cell: (row) => row.subject },
    { key: 'type', header: 'Type', cell: (row) => this.typeLabels[row.type] },
    { key: 'status', header: 'Status', cell: (row) => this.statusLabels[row.status] },
    { key: 'createdAt', header: 'Raised', sortable: true, cell: (row) => new Date(row.createdAt).toLocaleDateString() },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.ticketsService.list({ limit: 50 }).subscribe({
      next: ({ data }) => {
        this.tickets.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(TicketFormComponent, { width: '520px', data: {} });
    ref.afterClosed().subscribe((ticket: SupportTicket | undefined) => {
      if (!ticket) return;
      this.load();
      if (ticket.type === 'DOUBT' && ticket.aiResponse) {
        this.toast.success('Your question was answered automatically! Open the ticket to view it.');
      } else {
        this.toast.success('Ticket submitted. Our team will review it soon.');
      }
      this.viewTicket(ticket);
    });
  }

  viewTicket(ticket: SupportTicket): void {
    this.dialog.open(TicketDetailComponent, { width: '600px', data: { ticket } });
  }
}
