import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ACCOUNT_TYPES, BankAccount } from '../banks.model';
import { BanksService } from '../banks.service';

export interface BankFormDialogData {
  account?: BankAccount;
}

@Component({
  selector: 'app-bank-form',
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
  templateUrl: './bank-form.component.html',
  styleUrl: './bank-form.component.scss'
})
export class BankFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly banksService = inject(BanksService);
  private readonly dialogRef = inject(MatDialogRef<BankFormComponent>);
  readonly data = inject<BankFormDialogData>(MAT_DIALOG_DATA);

  readonly accountTypes = ACCOUNT_TYPES;
  readonly isEdit = !!this.data?.account;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    bankName: [this.data?.account?.bankName ?? '', [Validators.required, Validators.maxLength(120)]],
    accountType: [this.data?.account?.accountType ?? 'SAVINGS', [Validators.required]],
    balance: [this.data?.account?.balance ?? null, [Validators.required, Validators.min(0)]],
    ifsc: [this.data?.account?.ifsc ?? '', [Validators.required, Validators.pattern(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/)]],
    accountNumber: [
      '',
      this.isEdit ? [] : [Validators.required, Validators.pattern(/^\d{6,20}$/)],
    ],
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
      bankName: raw.bankName,
      accountType: raw.accountType,
      balance: Number(raw.balance),
      ifsc: raw.ifsc.toUpperCase(),
      ...(raw.accountNumber ? { accountNumber: raw.accountNumber } : {}),
    };

    const request = this.isEdit
      ? this.banksService.update(this.data.account!.id, payload)
      : this.banksService.create(payload);

    request.subscribe({
      next: (account) => {
        this.submitting.set(false);
        this.dialogRef.close(account);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save bank account.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

}
