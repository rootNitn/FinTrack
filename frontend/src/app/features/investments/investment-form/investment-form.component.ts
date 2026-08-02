import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import {
  INVESTMENT_CATEGORIES,
  INVESTMENT_STATUSES,
  Investment,
  InvestmentCategory,
  InvestmentStatus,
  RISK_LEVELS,
  RiskLevel,
} from '../investments.model';
import { InvestmentsService } from '../investments.service';
import { GoalsService } from '../../goals/goals.service';
import { Goal } from '../../goals/goals.model';
import { currencyCode, SUPPORTED_CURRENCIES } from '../../../shared/utils/currency.util';

export interface InvestmentFormDialogData {
  investment?: Investment;
}

interface LastInvestmentDefaults {
  category: InvestmentCategory;
  account: string;
  riskLevel: RiskLevel;
  status: InvestmentStatus;
  goalId: string;
}

const LAST_DEFAULTS_KEY = 'ft:lastInvestmentDefaults';

function readLastDefaults(): Partial<LastInvestmentDefaults> {
  try {
    return JSON.parse(localStorage.getItem(LAST_DEFAULTS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeLastDefaults(defaults: LastInvestmentDefaults): void {
  try {
    localStorage.setItem(LAST_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch {
    // localStorage unavailable (e.g. private browsing) — safe to ignore.
  }
}

@Component({
  selector: 'app-investment-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './investment-form.component.html',
  styleUrl: './investment-form.component.scss'
})
export class InvestmentFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly investmentsService = inject(InvestmentsService);
  private readonly goalsService = inject(GoalsService);
  private readonly dialogRef = inject(MatDialogRef<InvestmentFormComponent>);
  readonly data = inject<InvestmentFormDialogData>(MAT_DIALOG_DATA);

  readonly categories = INVESTMENT_CATEGORIES;
  readonly riskLevels = RISK_LEVELS;
  readonly statuses = INVESTMENT_STATUSES;
  readonly currencies = SUPPORTED_CURRENCIES;
  readonly baseCurrency = currencyCode;
  readonly isEdit = !!this.data?.investment;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly goals = signal<Goal[]>([]);
  readonly goalsLoading = signal(true);

  private readonly lastDefaults = this.isEdit ? {} : readLastDefaults();

  /** Number of investments added so far via "Save & Add Another" in this dialog session. */
  readonly addedCount = signal(0);
  readonly justAdded = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: [this.data?.investment?.name ?? '', [Validators.required, Validators.maxLength(150)]],
    category: [this.data?.investment?.category ?? this.lastDefaults.category ?? 'STOCKS', [Validators.required]],
    account: [this.data?.investment?.account ?? this.lastDefaults.account ?? ''],
    principalAmount: [this.data?.investment?.principalAmount ?? null, [Validators.required, Validators.min(0.01)]],
    currentValue: [this.data?.investment?.currentValue ?? null, [Validators.required, Validators.min(0)]],
    targetValue: [this.data?.investment?.targetValue ?? null],
    purchaseDate: [this.data?.investment ? new Date(this.data.investment.purchaseDate) : new Date(), [Validators.required]],
    maturityDate: [this.data?.investment?.maturityDate ? new Date(this.data.investment.maturityDate) : null],
    sipAmount: [this.data?.investment?.sipAmount ?? null],
    riskLevel: [this.data?.investment?.riskLevel ?? this.lastDefaults.riskLevel ?? 'MODERATE', [Validators.required]],
    notes: [this.data?.investment?.notes ?? ''],
    status: [this.data?.investment?.status ?? this.lastDefaults.status ?? 'ACTIVE', [Validators.required]],
    goalId: [this.data?.investment?.goalId ?? this.lastDefaults.goalId ?? ''],
    symbol: [this.data?.investment?.symbol ?? ''],
    units: [this.data?.investment?.units ?? null],
    currency: [this.data?.investment?.currency ?? currencyCode(), [Validators.required]],
    exchangeRate: [this.data?.investment?.exchangeRate ?? 1, [Validators.required, Validators.min(0.000001)]],
  });

  constructor() {
    this.goalsService.list().subscribe({
      next: (goals) => {
        this.goals.set(goals);
        this.goalsLoading.set(false);
      },
      error: () => this.goalsLoading.set(false),
    });
  }

  /** Symbol/units (used for live price refresh) are only relevant for Stocks and Mutual Funds. */
  showPriceRefreshFields(): boolean {
    const category = this.form.controls.category.value;
    return category === 'STOCKS' || category === 'MUTUAL_FUNDS';
  }

  /** The exchange-rate input is only needed once the holding's currency differs from the account's. */
  showExchangeRateField(): boolean {
    return this.form.controls.currency.value !== this.baseCurrency();
  }

  /** Native-currency equivalent of the entered amounts, shown as a live hint next to Exchange Rate. */
  nativeAmountsHint(): string {
    const rate = Number(this.form.controls.exchangeRate.value) || 1;
    const principal = Number(this.form.controls.principalAmount.value) || 0;
    const current = Number(this.form.controls.currentValue.value) || 0;
    const cur = this.form.controls.currency.value;
    return `≈ ${cur} ${(principal / rate).toFixed(2)} principal, ${cur} ${(current / rate).toFixed(2)} current value`;
  }

  submit(keepOpen = false): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.justAdded.set(false);
    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      ...raw,
      principalAmount: Number(raw.principalAmount),
      currentValue: Number(raw.currentValue),
      targetValue: raw.targetValue !== null && raw.targetValue !== undefined ? Number(raw.targetValue) : undefined,
      sipAmount: raw.sipAmount !== null && raw.sipAmount !== undefined ? Number(raw.sipAmount) : undefined,
      exchangeRate: Number(raw.exchangeRate) || 1,
      account: raw.account || undefined,
      notes: raw.notes || undefined,
      purchaseDate: (raw.purchaseDate as Date).toISOString(),
      maturityDate: raw.maturityDate ? (raw.maturityDate as Date).toISOString() : undefined,
      goalId: raw.goalId || null,
      symbol: raw.symbol || undefined,
      units: raw.units !== null && raw.units !== undefined ? Number(raw.units) : undefined,
    };

    if (!this.isEdit) {
      writeLastDefaults({
        category: raw.category,
        account: raw.account ?? '',
        riskLevel: raw.riskLevel,
        status: raw.status,
        goalId: raw.goalId ?? '',
      });
    }

    const request = this.isEdit
      ? this.investmentsService.update(this.data.investment!.id, payload)
      : this.investmentsService.create(payload);

    request.subscribe({
      next: (investment) => this.handleSaved(investment, keepOpen),
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save investment.');
      },
    });
  }

  private handleSaved(investment: Investment, keepOpen: boolean): void {
    this.submitting.set(false);

    if (this.isEdit || !keepOpen) {
      this.dialogRef.close(investment);
      return;
    }

    // "Save & Add Another": keep the dialog open, clear the one-off fields, and let the
    // user fire off the next entry quickly with category/account/risk/status retained.
    this.addedCount.update((n) => n + 1);
    this.justAdded.set(true);
    this.form.patchValue({
      name: '',
      principalAmount: null,
      currentValue: null,
      targetValue: null,
      sipAmount: null,
      maturityDate: null,
      notes: '',
    });
    this.form.controls.name.markAsUntouched();
    this.form.controls.name.markAsPristine();
    this.form.controls.principalAmount.markAsUntouched();
    this.form.controls.principalAmount.markAsPristine();
    this.form.controls.currentValue.markAsUntouched();
    this.form.controls.currentValue.markAsPristine();
  }

  /** Closes the dialog, reporting whether any investment was actually added this session. */
  cancel(): void {
    this.dialogRef.close(this.addedCount() > 0 ? { addedCount: this.addedCount() } : undefined);
  }

}
