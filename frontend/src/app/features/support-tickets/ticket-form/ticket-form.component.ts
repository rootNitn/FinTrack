import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { TICKET_TYPES } from '../support-tickets.model';
import { SupportTicketsService } from '../support-tickets.service';

@Component({
  selector: 'app-ticket-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './ticket-form.component.html',
  styleUrl: './ticket-form.component.scss',
})
export class TicketFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ticketsService = inject(SupportTicketsService);
  private readonly dialogRef = inject(MatDialogRef<TicketFormComponent>);

  readonly ticketTypes = TICKET_TYPES;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    type: ['DOUBT' as 'DOUBT' | 'SUGGESTION' | 'ERROR', Validators.required],
    subject: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(5000)]],
  });

  get selectedTypeHint(): string {
    return this.ticketTypes.find((t) => t.value === this.form.controls.type.value)?.hint ?? '';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    this.ticketsService.create(raw).subscribe({
      next: (ticket) => {
        this.submitting.set(false);
        this.dialogRef.close(ticket);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to submit ticket. Please try again.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
