import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { SupportTicket, TICKET_STATUS_LABELS, TICKET_TYPE_ICONS, TICKET_TYPE_LABELS } from '../support-tickets.model';

export interface TicketDetailDialogData {
  ticket: SupportTicket;
}

@Component({
  selector: 'app-ticket-detail',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatChipsModule],
  templateUrl: './ticket-detail.component.html',
  styleUrl: './ticket-detail.component.scss',
})
export class TicketDetailComponent {
  readonly data = inject<TicketDetailDialogData>(MAT_DIALOG_DATA);

  readonly typeLabels = TICKET_TYPE_LABELS;
  readonly typeIcons = TICKET_TYPE_ICONS;
  readonly statusLabels = TICKET_STATUS_LABELS;

  get ticket(): SupportTicket {
    return this.data.ticket;
  }
}
