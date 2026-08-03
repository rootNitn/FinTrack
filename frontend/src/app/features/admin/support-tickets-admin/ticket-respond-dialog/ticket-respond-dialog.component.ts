import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  SupportTicket,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  TICKET_TYPE_ICONS,
  TICKET_TYPE_LABELS,
} from '../../../support-tickets/support-tickets.model';
import { SupportTicketsService } from '../../../support-tickets/support-tickets.service';

export interface TicketRespondDialogData {
  ticket: SupportTicket;
}

@Component({
  selector: 'app-ticket-respond-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './ticket-respond-dialog.component.html',
  styleUrl: './ticket-respond-dialog.component.scss',
})
export class TicketRespondDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ticketsService = inject(SupportTicketsService);
  private readonly dialogRef = inject(MatDialogRef<TicketRespondDialogComponent>);
  readonly data = inject<TicketRespondDialogData>(MAT_DIALOG_DATA);

  readonly typeLabels = TICKET_TYPE_LABELS;
  readonly typeIcons = TICKET_TYPE_ICONS;
  readonly statusLabels = TICKET_STATUS_LABELS;
  readonly ticketStatuses = TICKET_STATUSES;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly ticket = this.data.ticket;

  readonly form = this.fb.nonNullable.group({
    status: [this.ticket.status],
    adminResponse: [this.ticket.adminResponse ?? ''],
  });

  submit(): void {
    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    this.ticketsService.updateAdmin(this.ticket.id, raw).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.dialogRef.close(updated);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to update ticket. Please try again.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
