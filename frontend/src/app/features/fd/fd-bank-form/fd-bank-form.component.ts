import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FdBanksService } from '../fd-banks.service';
import { FdBank, FD_BANK_TYPE_LABELS, FdBankType } from '../fd.model';

export interface FdBankFormDialogData {
  bank?: FdBank;
}

@Component({
  selector: 'app-fd-bank-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './fd-bank-form.component.html',
})
export class FdBankFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly banksService = inject(FdBanksService);
  private readonly dialogRef = inject(MatDialogRef<FdBankFormComponent>);
  readonly data = inject<FdBankFormDialogData>(MAT_DIALOG_DATA);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly bankTypeLabels = FD_BANK_TYPE_LABELS;
  readonly bankTypes = Object.keys(FD_BANK_TYPE_LABELS) as FdBankType[];

  readonly form = this.fb.nonNullable.group({
    name: [this.data.bank?.name ?? '', Validators.required],
    logoUrl: [this.data.bank?.logoUrl ?? ''],
    bankType: [this.data.bank?.bankType ?? ('PRIVATE' as FdBankType), Validators.required],
    rating: [this.data.bank?.rating ?? 4, [Validators.min(0), Validators.max(5)]],
    minDeposit: [this.data.bank?.minDeposit ?? 1000, [Validators.required, Validators.min(1)]],
    maxDeposit: [this.data.bank?.maxDeposit ?? null],
    depositInsuranceCover: [this.data.bank?.depositInsuranceCover ?? 500000],
    prosText: [(this.data.bank?.pros ?? []).join('\n')],
    consText: [(this.data.bank?.cons ?? []).join('\n')],
    featuresText: [(this.data.bank?.features ?? []).join('\n')],
    prematureWithdrawalRules: [this.data.bank?.prematureWithdrawalRules ?? ''],
    penaltyRules: [this.data.bank?.penaltyRules ?? ''],
    taxInfo: [this.data.bank?.taxInfo ?? ''],
    customerSupportPhone: [this.data.bank?.customerSupportPhone ?? ''],
    customerSupportEmail: [this.data.bank?.customerSupportEmail ?? ''],
    websiteUrl: [this.data.bank?.websiteUrl ?? ''],
    isActive: [this.data.bank?.isActive ?? true],
  });

  private toLines(text: string): string[] {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const raw = this.form.getRawValue();

    const payload = {
      name: raw.name,
      logoUrl: raw.logoUrl || undefined,
      bankType: raw.bankType,
      rating: Number(raw.rating),
      minDeposit: Number(raw.minDeposit),
      maxDeposit: raw.maxDeposit ? Number(raw.maxDeposit) : undefined,
      depositInsuranceCover: Number(raw.depositInsuranceCover),
      pros: this.toLines(raw.prosText),
      cons: this.toLines(raw.consText),
      features: this.toLines(raw.featuresText),
      prematureWithdrawalRules: raw.prematureWithdrawalRules || undefined,
      penaltyRules: raw.penaltyRules || undefined,
      taxInfo: raw.taxInfo || undefined,
      customerSupportPhone: raw.customerSupportPhone || undefined,
      customerSupportEmail: raw.customerSupportEmail || undefined,
      websiteUrl: raw.websiteUrl || undefined,
      isActive: raw.isActive,
    };

    const request = this.data.bank ? this.banksService.update(this.data.bank.id, payload) : this.banksService.create(payload);
    request.subscribe({
      next: (bank) => {
        this.submitting.set(false);
        this.dialogRef.close(bank);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.error?.message ?? 'Failed to save bank.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
