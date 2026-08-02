import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CARD_NETWORKS, CARD_NETWORK_LABELS, CreditCard } from '../credit-cards.model';
import { CreditCardsService } from '../credit-cards.service';

export interface CreditCardFormDialogData {
  card?: CreditCard;
}

@Component({
  selector: 'app-credit-card-form',
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
  templateUrl: './credit-card-form.component.html',
  styleUrl: './credit-card-form.component.scss',
})
export class CreditCardFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly creditCardsService = inject(CreditCardsService);
  private readonly dialogRef = inject(MatDialogRef<CreditCardFormComponent>);
  readonly data = inject<CreditCardFormDialogData>(MAT_DIALOG_DATA);

  readonly networks = CARD_NETWORKS;
  readonly networkLabels = CARD_NETWORK_LABELS;
  readonly isEdit = !!this.data?.card;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    cardName: [this.data?.card?.cardName ?? '', [Validators.required, Validators.maxLength(120)]],
    bankName: [this.data?.card?.bankName ?? '', [Validators.required, Validators.maxLength(120)]],
    network: [this.data?.card?.network ?? 'OTHER', [Validators.required]],
    cardNumber: ['', this.isEdit ? [] : [Validators.required, Validators.pattern(/^\d{12,19}$/)]],
    creditLimit: [this.data?.card?.creditLimit ?? null, [Validators.required, Validators.min(1)]],
    currentOutstanding: [this.data?.card?.currentOutstanding ?? 0, [Validators.required, Validators.min(0)]],
    statementDay: [this.data?.card?.statementDay ?? 1, [Validators.required, Validators.min(1), Validators.max(31)]],
    paymentDueDays: [this.data?.card?.paymentDueDays ?? 20, [Validators.required, Validators.min(1), Validators.max(60)]],
    annualFee: [this.data?.card?.annualFee ?? 0, [Validators.required, Validators.min(0)]],
    interestRatePercent: [this.data?.card?.interestRatePercent ?? 3.5, [Validators.required, Validators.min(0)]],
    notes: [this.data?.card?.notes ?? ''],
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
      cardName: raw.cardName,
      bankName: raw.bankName,
      network: raw.network,
      creditLimit: Number(raw.creditLimit),
      currentOutstanding: Number(raw.currentOutstanding),
      statementDay: Number(raw.statementDay),
      paymentDueDays: Number(raw.paymentDueDays),
      annualFee: Number(raw.annualFee),
      interestRatePercent: Number(raw.interestRatePercent),
      ...(raw.notes ? { notes: raw.notes } : {}),
      ...(raw.cardNumber ? { cardNumber: raw.cardNumber } : {}),
    };

    const request = this.isEdit
      ? this.creditCardsService.update(this.data.card!.id, payload)
      : this.creditCardsService.create(payload);

    request.subscribe({
      next: (card) => {
        this.submitting.set(false);
        this.dialogRef.close(card);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save credit card.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
