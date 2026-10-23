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
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  INVESTMENT_CATEGORIES,
  INVESTMENT_STATUSES,
  Investment,
  InvestmentCategory,
  InvestmentStatus,
  RECURRENCE_INTERVALS,
  RISK_LEVELS,
  RiskLevel,
  FdCompoundingFrequency,
  FdDepositType,
  FdTenureUnit,
} from '../investments.model';
import { InvestmentsService } from '../investments.service';
import { GoalsService } from '../../goals/goals.service';
import { Goal } from '../../goals/goals.model';
import { FamilyMember } from '../../family-members/family-members.model';
import { FamilyMembersService } from '../../family-members/family-members.service';
import { BankAccount } from '../../banks/banks.model';
import { BanksService } from '../../banks/banks.service';
import { currencyCode, SUPPORTED_CURRENCIES } from '../../../shared/utils/currency.util';
import { formatDateTime } from '../../../shared/utils/date.util';

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
    MatCheckboxModule,
  ],
  templateUrl: './investment-form.component.html',
  styleUrl: './investment-form.component.scss'
})
export class InvestmentFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly investmentsService = inject(InvestmentsService);
  private readonly goalsService = inject(GoalsService);
  private readonly familyMembersService = inject(FamilyMembersService);
  private readonly banksService = inject(BanksService);
  private readonly dialogRef = inject(MatDialogRef<InvestmentFormComponent>);
  readonly data = inject<InvestmentFormDialogData>(MAT_DIALOG_DATA);

  readonly categories = INVESTMENT_CATEGORIES;
  readonly riskLevels = RISK_LEVELS;
  readonly statuses = INVESTMENT_STATUSES;
  readonly recurrenceIntervals = RECURRENCE_INTERVALS;
  readonly currencies = SUPPORTED_CURRENCIES;
  readonly baseCurrency = currencyCode;
  readonly isEdit = !!this.data?.investment;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly goals = signal<Goal[]>([]);
  readonly goalsLoading = signal(true);
  readonly familyMembers = signal<FamilyMember[]>([]);
  readonly bankAccounts = signal<BankAccount[]>([]);
  readonly bankAccountsLoading = signal(true);
  readonly fdTenureUnits: FdTenureUnit[] = ['DAYS', 'MONTHS', 'YEARS'];
  readonly fdDepositTypes: FdDepositType[] = ['CUMULATIVE', 'MONTHLY_INTEREST', 'QUARTERLY_INTEREST'];
  readonly fdCompoundingOptions: FdCompoundingFrequency[] = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUALLY'];
  readonly maxPurchaseDate = new Date();
  readonly fdPreview = signal<{ maturityAmount: number; maturityDate: Date } | null>(null);

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
    familyMemberId: [this.data?.investment?.familyMemberId ?? ''],
    symbol: [this.data?.investment?.symbol ?? ''],
    units: [this.data?.investment?.units ?? null],
    currency: [this.data?.investment?.currency ?? currencyCode(), [Validators.required]],
    exchangeRate: [this.data?.investment?.exchangeRate ?? 1, [Validators.required, Validators.min(0.000001)]],
    isRecurring: [this.data?.investment?.isRecurring ?? false],
    recurrenceInterval: [this.data?.investment?.recurrenceInterval ?? 'MONTHLY'],
    recurrenceEndDate: [this.data?.investment?.recurrenceEndDate ? new Date(this.data.investment.recurrenceEndDate) : null],
    fdTenureValue: [this.data?.investment?.fdTenureValue ?? null],
    fdTenureUnit: [this.data?.investment?.fdTenureUnit ?? 'YEARS'],
    fdInterestRate: [this.data?.investment?.fdInterestRate ?? null],
    fdCompounding: [this.data?.investment?.fdCompounding ?? 'QUARTERLY'],
    fdDepositType: [this.data?.investment?.fdDepositType ?? 'CUMULATIVE'],
  });

  constructor() {
    this.updateFdValidators();
    this.goalsService.list().subscribe({
      next: (goals) => {
        this.goals.set(goals);
        this.goalsLoading.set(false);
      },
      error: () => this.goalsLoading.set(false),
    });
    this.familyMembersService.list().subscribe((members) => this.familyMembers.set(members));
    this.banksService.list().subscribe({
      next: (accounts) => {
        this.bankAccounts.set(accounts);
        this.bankAccountsLoading.set(false);
      },
      error: () => this.bankAccountsLoading.set(false),
    });
    this.recalculateFdPreview();
  }

  /** Symbol/units (used for live price refresh) are only relevant for Stocks and Mutual Funds. */
  showPriceRefreshFields(): boolean {
    const category = this.form.controls.category.value;
    return category === 'STOCKS' || category === 'MUTUAL_FUNDS';
  }

  isFixedDeposit(): boolean {
    return this.form.controls.category.value === 'FIXED_DEPOSIT';
  }

  recalculateFdPreview(): void {
    if (!this.isFixedDeposit()) {
      this.fdPreview.set(null);
      return;
    }
    const principal = Number(this.form.controls.principalAmount.value);
    const rate = Number(this.form.controls.fdInterestRate.value);
    const tenure = Number(this.form.controls.fdTenureValue.value);
    const startDate = this.form.controls.purchaseDate.value as Date;
    if (!principal || !rate || !tenure || !startDate) {
      this.fdPreview.set(null);
      return;
    }
    const unit = this.form.controls.fdTenureUnit.value;
    const tenureYears = unit === 'DAYS' ? tenure / 365 : unit === 'MONTHS' ? tenure / 12 : tenure;
    const frequency = this.form.controls.fdCompounding.value;
    const compoundsPerYear = frequency === 'MONTHLY' ? 12 : frequency === 'QUARTERLY' ? 4 : frequency === 'HALF_YEARLY' ? 2 : 1;
    const depositType = this.form.controls.fdDepositType.value;
    const maturityAmount = depositType === 'CUMULATIVE'
      ? principal * Math.pow(1 + rate / 100 / compoundsPerYear, compoundsPerYear * tenureYears)
      : principal;
    const maturityDate = new Date(startDate);
    maturityDate.setDate(maturityDate.getDate() + (unit === 'DAYS' ? tenure : unit === 'MONTHS' ? Math.round(tenure * 30) : Math.round(tenure * 365)));
    this.fdPreview.set({ maturityAmount, maturityDate });
  }

  updateFdValidators(): void {
    const controls = [
      this.form.controls.fdTenureValue,
      this.form.controls.fdTenureUnit,
      this.form.controls.fdInterestRate,
      this.form.controls.fdCompounding,
      this.form.controls.fdDepositType,
    ];
    if (this.isFixedDeposit()) {
      this.form.controls.currentValue.clearValidators();
      controls.forEach((control) => control.addValidators(Validators.required));
    } else {
      this.form.controls.currentValue.addValidators([Validators.required, Validators.min(0)]);
      controls.forEach((control) => control.clearValidators());
    }
    this.form.controls.currentValue.updateValueAndValidity({ emitEvent: false });
    controls.forEach((control) => control.updateValueAndValidity({ emitEvent: false }));
  }

  /** The exchange-rate input is only needed once the holding's currency differs from the account's. */
  showExchangeRateField(): boolean {
    return this.form.controls.currency.value !== this.baseCurrency();
  }

  /** True once this row has any broker/live-price data worth surfacing (read-only, not user-editable here). */
  hasLiveData(): boolean {
    const inv = this.data?.investment;
    return !!inv && (inv.currentNav != null || inv.lastPriceRefreshAt != null || (!!inv.source && inv.source !== 'MANUAL'));
  }

  liveDataSourceLabel(): string {
    const inv = this.data?.investment;
    return inv?.source && inv.source !== 'MANUAL' ? `${inv.source}${inv.broker ? ` (${inv.broker})` : ''}` : 'Manual entry';
  }

  liveDataLastRefreshLabel(): string {
    const at = this.data?.investment?.lastPriceRefreshAt;
    return at ? formatDateTime(at) : 'Never refreshed';
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
    const fdPreview = this.fdPreview();
    const selectedAccount = this.bankAccounts().find((account) => account.id === raw.account);
    const payload = {
      ...raw,
      principalAmount: Number(raw.principalAmount),
      currentValue: this.isFixedDeposit() && fdPreview ? Number(fdPreview.maturityAmount.toFixed(2)) : Number(raw.currentValue),
      targetValue: raw.targetValue !== null && raw.targetValue !== undefined ? Number(raw.targetValue) : undefined,
      sipAmount: raw.sipAmount !== null && raw.sipAmount !== undefined ? Number(raw.sipAmount) : undefined,
      exchangeRate: Number(raw.exchangeRate) || 1,
      account: (selectedAccount?.bankName ?? raw.account) || undefined,
      notes: raw.notes || undefined,
      purchaseDate: (raw.purchaseDate as Date).toISOString(),
      maturityDate: this.isFixedDeposit() && fdPreview ? fdPreview.maturityDate.toISOString() : (raw.maturityDate ? (raw.maturityDate as Date).toISOString() : undefined),
      goalId: raw.goalId || null,
      familyMemberId: raw.familyMemberId || null,
      symbol: raw.symbol || undefined,
      units: raw.units !== null && raw.units !== undefined ? Number(raw.units) : undefined,
      isRecurring: raw.isRecurring,
      recurrenceInterval: raw.isRecurring ? raw.recurrenceInterval : undefined,
      recurrenceEndDate: raw.isRecurring && raw.recurrenceEndDate ? (raw.recurrenceEndDate as Date).toISOString() : undefined,
      fdTenureValue: this.isFixedDeposit() ? Number(raw.fdTenureValue) : undefined,
      fdTenureUnit: this.isFixedDeposit() ? raw.fdTenureUnit : undefined,
      fdInterestRate: this.isFixedDeposit() ? Number(raw.fdInterestRate) : undefined,
      fdCompounding: this.isFixedDeposit() ? raw.fdCompounding : undefined,
      fdDepositType: this.isFixedDeposit() ? raw.fdDepositType : undefined,
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

  accountLabel(account: BankAccount): string {
    return `${account.bankName} (${account.accountType}) • ${account.accountNumber}`;
  }

  hasLegacyAccountValue(): boolean {
    const value = this.form.controls.account.value;
    return !!value && !this.bankAccounts().some((account) => account.id === value);
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
