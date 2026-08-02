import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CreditCardStatement } from '../credit-cards.model';
import { CreditCardsService } from '../credit-cards.service';

export interface PaymentFormDialogData {
  cardId: string;
  statements: CreditCardStatement[];
}

@Component({
  selector: 'app-payment-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './payment-form.component.html',
  styleUrl: './payment-form.component.scss',
})
export class PaymentFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly creditCardsService = inject(CreditCardsService);
  private readonly dialogRef = inject(MatDialogRef<PaymentFormComponent>);
  readonly data = inject<PaymentFormDialogData>(MAT_DIALOG_DATA);

  readonly unpaidStatements = this.data.statements.filter((s) => s.status !== 'PAID');
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
    paidDate: [new Date(), [Validators.required]],
    statementId: [''],
    method: [''],
    notes: [''],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      amount: Number(raw.amount),
      paidDate: new Date(raw.paidDate).toISOString(),
      ...(raw.statementId ? { statementId: raw.statementId } : {}),
      ...(raw.method ? { method: raw.method } : {}),
      ...(raw.notes ? { notes: raw.notes } : {}),
    };

    this.creditCardsService.recordPayment(this.data.cardId, payload).subscribe({
      next: (payment) => {
        this.submitting.set(false);
        this.dialogRef.close(payment);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to record payment.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
