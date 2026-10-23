import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FdRatesService } from '../fd-rates.service';
import { FdBank, FdRate, FD_COMPOUNDING_LABELS, FdCompoundingFrequency } from '../fd.model';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';

export interface FdRateManagerDialogData {
  bank: FdBank;
}

const TENURE_OPTIONS = [
  '7 Days - 45 Days',
  '46 Days - 179 Days',
  '180 Days - 270 Days',
  '271 Days - 364 Days',
  '1 Year',
  '2 Years',
  '3 Years',
  '5 Years',
];

@Component({
  selector: 'app-fd-rate-manager-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
  ],
  templateUrl: './fd-rate-manager-dialog.component.html',
})
export class FdRateManagerDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly ratesService = inject(FdRatesService);
  private readonly dialogRef = inject(MatDialogRef<FdRateManagerDialogComponent>);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  readonly data = inject<FdRateManagerDialogData>(MAT_DIALOG_DATA);

  readonly rates = signal<FdRate[]>([]);
  readonly loading = signal(true);
  readonly editingId = signal<string | null>(null);
  readonly tenureOptions = TENURE_OPTIONS;
  readonly compoundingLabels = FD_COMPOUNDING_LABELS;
  readonly compoundingOptions = Object.keys(FD_COMPOUNDING_LABELS) as FdCompoundingFrequency[];

  readonly form = this.fb.nonNullable.group({
    tenureLabel: [TENURE_OPTIONS[4], Validators.required],
    tenureMinDays: [365, [Validators.required, Validators.min(1)]],
    tenureMaxDays: [365, [Validators.required, Validators.min(1)]],
    interestRate: [7, [Validators.required, Validators.min(0.1), Validators.max(20)]],
    seniorCitizenRate: [7.5, [Validators.required, Validators.min(0.1), Validators.max(20)]],
    compounding: ['QUARTERLY' as FdCompoundingFrequency, Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.ratesService.listByBank(this.data.bank.id).subscribe({
      next: (rates) => {
        this.rates.set(rates);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  edit(rate: FdRate): void {
    this.editingId.set(rate.id);
    this.form.patchValue({
      tenureLabel: rate.tenureLabel,
      tenureMinDays: rate.tenureMinDays,
      tenureMaxDays: rate.tenureMaxDays,
      interestRate: rate.interestRate,
      seniorCitizenRate: rate.seniorCitizenRate,
      compounding: rate.compounding,
    });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.form.reset({
      tenureLabel: TENURE_OPTIONS[4],
      tenureMinDays: 365,
      tenureMaxDays: 365,
      interestRate: 7,
      seniorCitizenRate: 7.5,
      compounding: 'QUARTERLY',
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const payload = {
      tenureLabel: raw.tenureLabel,
      tenureMinDays: Number(raw.tenureMinDays),
      tenureMaxDays: Number(raw.tenureMaxDays),
      interestRate: Number(raw.interestRate),
      seniorCitizenRate: Number(raw.seniorCitizenRate),
      compounding: raw.compounding,
    };

    const editingId = this.editingId();
    const request = editingId
      ? this.ratesService.update(editingId, payload)
      : this.ratesService.create({ ...payload, bankId: this.data.bank.id });

    request.subscribe(() => {
      this.resetForm();
      this.load();
    });
  }

  remove(rate: FdRate): void {
    this.confirmDialog
      .open({
        title: 'Delete interest rate',
        message: `Remove the ${rate.tenureLabel} rate entry? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.ratesService.remove(rate.id).subscribe(() => {
          this.toast.success('Rate deleted.');
          this.load();
        });
      });
  }

  close(): void {
    this.dialogRef.close();
  }
}
