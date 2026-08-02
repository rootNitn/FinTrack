import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CreditCard } from '../credit-cards.model';
import { CreditCardsService } from '../credit-cards.service';

export interface RedeemDialogData {
  card: CreditCard;
}

@Component({
  selector: 'app-redeem-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './redeem-dialog.component.html',
  styleUrl: './redeem-dialog.component.scss',
})
export class RedeemDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly creditCardsService = inject(CreditCardsService);
  private readonly dialogRef = inject(MatDialogRef<RedeemDialogComponent>);
  readonly data = inject<RedeemDialogData>(MAT_DIALOG_DATA);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    type: ['POINTS' as 'POINTS' | 'CASHBACK', [Validators.required]],
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    this.creditCardsService.redeem(this.data.card.id, { type: raw.type, amount: Number(raw.amount) }).subscribe({
      next: (card) => {
        this.submitting.set(false);
        this.dialogRef.close(card);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to redeem.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
