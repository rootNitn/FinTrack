import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FdBanksService } from '../fd-banks.service';
import { FdPortfolioService } from '../fd-portfolio.service';
import {
  FdBank,
  FdPortfolioEntry,
  FD_COMPOUNDING_LABELS,
  FD_DEPOSIT_TYPE_LABELS,
  FdCompoundingFrequency,
  FdDepositType,
  FdPortfolioStatus,
} from '../fd.model';

export interface FdPortfolioFormDialogData {
  entry?: FdPortfolioEntry;
}

@Component({
  selector: 'app-fd-portfolio-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './fd-portfolio-form.component.html',
})
export class FdPortfolioFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly banksService = inject(FdBanksService);
  private readonly portfolioService = inject(FdPortfolioService);
  private readonly dialogRef = inject(MatDialogRef<FdPortfolioFormComponent>);
  readonly data = inject<FdPortfolioFormDialogData>(MAT_DIALOG_DATA);

  readonly banks = signal<FdBank[]>([]);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly depositTypeLabels = FD_DEPOSIT_TYPE_LABELS;
  readonly compoundingLabels = FD_COMPOUNDING_LABELS;
  readonly depositTypes = Object.keys(FD_DEPOSIT_TYPE_LABELS) as FdDepositType[];
  readonly compoundingOptions = Object.keys(FD_COMPOUNDING_LABELS) as FdCompoundingFrequency[];
  readonly statuses: FdPortfolioStatus[] = ['ACTIVE', 'MATURED', 'CLOSED', 'RENEWED'];

  readonly form = this.fb.nonNullable.group({
    bankId: [this.data.entry?.bankId ?? ''],
    bankName: [this.data.entry?.bankName ?? '', Validators.required],
    amount: [this.data.entry?.amount ?? null, [Validators.required, Validators.min(1)]],
    interestRate: [this.data.entry?.interestRate ?? null, [Validators.required, Validators.min(0.1), Validators.max(20)]],
    depositType: [this.data.entry?.depositType ?? ('CUMULATIVE' as FdDepositType), Validators.required],
    compounding: [this.data.entry?.compounding ?? ('QUARTERLY' as FdCompoundingFrequency), Validators.required],
    openingDate: [this.data.entry ? new Date(this.data.entry.openingDate) : new Date(), Validators.required],
    maturityDate: [this.data.entry ? new Date(this.data.entry.maturityDate) : null, Validators.required],
    nominee: [this.data.entry?.nominee ?? ''],
    notes: [this.data.entry?.notes ?? ''],
    status: [this.data.entry?.status ?? ('ACTIVE' as FdPortfolioStatus)],
  });

  ngOnInit(): void {
    this.banksService.list({ activeOnly: true }).subscribe((banks) => this.banks.set(banks));
  }

  onBankSelected(bankId: string): void {
    const bank = this.banks().find((b) => b.id === bankId);
    if (bank) {
      this.form.patchValue({ bankName: bank.name });
    }
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
      bankId: raw.bankId || undefined,
      bankName: raw.bankName,
      amount: Number(raw.amount),
      interestRate: Number(raw.interestRate),
      depositType: raw.depositType,
      compounding: raw.compounding,
      openingDate: new Date(raw.openingDate).toISOString(),
      maturityDate: new Date(raw.maturityDate!).toISOString(),
      nominee: raw.nominee || undefined,
      notes: raw.notes || undefined,
      status: raw.status,
    };

    const request = this.data.entry
      ? this.portfolioService.update(this.data.entry.id, payload)
      : this.portfolioService.create(payload);

    request.subscribe({
      next: (entry) => {
        this.submitting.set(false);
        this.dialogRef.close(entry);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.error?.message ?? 'Failed to save FD entry.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
