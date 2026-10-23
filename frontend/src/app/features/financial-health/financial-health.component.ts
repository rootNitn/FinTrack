import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { FinancialHealthService } from './financial-health.service';
import { SettingsService } from '../settings/settings.service';
import {
  ActionPlanItem,
  CreateInsurancePolicyPayload,
  CreateLiabilityPayload,
  DebtPayoffStrategyResult,
  FINANCIAL_HEALTH_STATUS_BADGE_CLASSES,
  FINANCIAL_HEALTH_STATUS_LABELS,
  FinancialHealthRule,
  FinancialHealthStatus,
  FinancialHealthSummary,
  INSURANCE_TYPE_LABELS,
  InsurancePolicy,
  InsuranceType,
  LIABILITY_TYPE_LABELS,
  Liability,
  LiabilityAmortization,
  LiabilityType,
} from './financial-health.model';
import { formatCurrency } from '../../shared/utils/currency.util';

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function formatDataValue(key: string, value: number | null): string {
  if (value === null) return '—';
  if (/^age$/i.test(key)) return `${value}`;
  if (/percent/i.test(key)) return `${value}%`;
  if (/years/i.test(key)) return `${value} yrs`;
  if (/months/i.test(key)) return `${value} mo`;
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

// Mirrors the scored-rule categories: Safety Net -> Behavior -> Allocation -> Goals -> Score.
// Rules of thumb (50/30/20, 100-Age, 60/30/10, Save the Raise, Rule of 72) are benchmarks, not scored, so excluded here.
const RULE_PIPELINE_ORDER = ['emergency-fund', 'savings-rate', 'rebalancing'];

interface TierLegendRow {
  range: string;
  emoji: string;
  label: string;
}

// Reference scale shown alongside rules that score against named tiers (app-defined, not official rules).
const TIER_LEGENDS: Record<string, TierLegendRow[]> = {
  'emergency-fund': [
    { range: '< 1 month', emoji: '🔴', label: 'Critical' },
    { range: '1–3 months', emoji: '🟠', label: 'Building' },
    { range: '3–6 months', emoji: '🟢', label: 'Healthy' },
    { range: '6–12 months', emoji: '🟢', label: 'Strong' },
    { range: '> 12 months', emoji: '🟡', label: 'Review excess cash' },
  ],
  'savings-rate': [
    { range: '< 10%', emoji: '🔴', label: 'Critical' },
    { range: '10–19%', emoji: '🟠', label: 'Low' },
    { range: '20–29%', emoji: '🟡', label: 'Good' },
    { range: '30–39%', emoji: '🟢', label: 'Excellent' },
    { range: '40%+', emoji: '🟢', label: 'Exceptional' },
  ],
  rebalancing: [
    { range: '< 5 pts off target', emoji: '🟢', label: 'On Track' },
    { range: '5–10 pts off target', emoji: '🟡', label: 'Review' },
    { range: '> 10 pts off target', emoji: '🟠', label: 'Rebalancing Needed' },
  ],
  'debt-health': [
    { range: '< 20% of annual income', emoji: '🟢', label: 'Healthy' },
    { range: '20–35% of annual income', emoji: '🟡', label: 'Moderate' },
    { range: '> 35% of annual income', emoji: '🔴', label: 'High' },
  ],
  diversification: [
    { range: '≤ 10% of equity', emoji: '🟢', label: 'Diversified' },
    { range: '10–20% of equity', emoji: '🟡', label: 'Review' },
    { range: '> 20% of equity', emoji: '🔴', label: 'High Concentration' },
  ],
  'retirement-readiness': [
    { range: '< 25%', emoji: '🔴', label: 'Critical' },
    { range: '25–49%', emoji: '🟠', label: 'Underfunded' },
    { range: '50–79%', emoji: '🟡', label: 'Partially Funded' },
    { range: '80–99%', emoji: '🟢', label: 'On Track' },
    { range: '100%+', emoji: '🟢', label: 'Fully Funded' },
  ],
  'investment-discipline': [
    { range: '> 95%', emoji: '🟢', label: 'Excellent' },
    { range: '90–95%', emoji: '🟢', label: 'Good' },
    { range: '75–90%', emoji: '🟡', label: 'Fair' },
    { range: '< 75%', emoji: '🔴', label: 'Poor' },
  ],
};

const GOAL_FUNDING_PREFIX = 'goal-funding-';

// Cross-links to Calculators' "what-if" tools for rules with a matching exploratory calculator
// (feature overlap audit, 2026-08-10) — Financial Health scores live data; Calculators lets users
// vary assumptions (inflation, custom returns, custom target months) instead of duplicating that UI here.
const CALCULATOR_LINKS: Record<string, { slug: string; label: string }> = {
  'retirement-readiness': { slug: 'retirement', label: 'Retirement Calculator' },
  'emergency-fund': { slug: 'emergency-fund', label: 'Emergency Fund Calculator' },
};

// Financial Foundation / Wealth Building / Future Readiness / Protection & Tax quadrant groupings.
const FOUNDATION_RULE_IDS = ['savings-rate', 'emergency-fund', 'debt-health'];
const WEALTH_RULE_IDS = ['rebalancing', 'diversification'];
const FUTURE_RULE_IDS = ['retirement-readiness'];
const PROTECTION_RULE_IDS = ['insurance', 'tax-efficiency', 'investment-discipline'];

@Component({
  selector: 'app-financial-health',
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, PageHeaderComponent, SkeletonLoaderComponent],
  templateUrl: './financial-health.component.html',
  styleUrl: './financial-health.component.scss',
})
export class FinancialHealthComponent implements OnInit {
  private readonly financialHealthService = inject(FinancialHealthService);
  private readonly settingsService = inject(SettingsService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly statusLabels = FINANCIAL_HEALTH_STATUS_LABELS;
  readonly statusBadgeClasses = FINANCIAL_HEALTH_STATUS_BADGE_CLASSES;
  readonly liabilityTypeLabels = LIABILITY_TYPE_LABELS;
  readonly liabilityTypes = Object.keys(LIABILITY_TYPE_LABELS) as LiabilityType[];
  readonly insuranceTypeLabels = INSURANCE_TYPE_LABELS;
  readonly insuranceTypes = Object.keys(INSURANCE_TYPE_LABELS) as InsuranceType[];

  readonly loading = signal(true);
  readonly summary = signal<FinancialHealthSummary | null>(null);
  readonly liabilities = signal<Liability[]>([]);
  readonly insurancePolicies = signal<InsurancePolicy[]>([]);

  readonly scoredRules = computed<FinancialHealthRule[]>(() =>
    (this.summary()?.rules ?? []).filter((r) => !r.id.startsWith(GOAL_FUNDING_PREFIX)),
  );

  readonly goalRules = computed<FinancialHealthRule[]>(() =>
    (this.summary()?.rules ?? []).filter((r) => r.id.startsWith(GOAL_FUNDING_PREFIX)),
  );

  private ruleGroup(ids: string[]): FinancialHealthRule[] {
    const rules = this.scoredRules().filter((r) => ids.includes(r.id));
    return [...rules].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  }

  readonly foundationRules = computed(() => this.ruleGroup(FOUNDATION_RULE_IDS));
  readonly wealthRules = computed(() => this.ruleGroup(WEALTH_RULE_IDS));
  readonly futureRules = computed(() => this.ruleGroup(FUTURE_RULE_IDS));
  readonly protectionRules = computed(() => this.ruleGroup(PROTECTION_RULE_IDS));

  readonly topActions = computed<ActionPlanItem[]>(() => this.summary()?.topActions ?? []);

  readonly pipelineRules = computed<FinancialHealthRule[]>(() => {
    const rules = (this.summary()?.rules ?? []).filter((r) => RULE_PIPELINE_ORDER.includes(r.id));
    return [...rules].sort((a, b) => RULE_PIPELINE_ORDER.indexOf(a.id) - RULE_PIPELINE_ORDER.indexOf(b.id));
  });

  readonly benchmarks = computed<FinancialHealthRule[]>(() => this.summary()?.benchmarks ?? []);
  readonly netWorth = computed(() => this.summary()?.netWorth ?? null);

  // Target allocation editor state (Rebalancing Score) — defaults mirror the 60/30/10 fallback.
  readonly editingTarget = signal(false);
  readonly targetEquity = signal(60);
  readonly targetDebt = signal(30);
  readonly targetGold = signal(10);
  readonly savingTarget = signal(false);

  // Retirement assumptions editor state (Retirement Readiness / FI Ratio).
  readonly editingRetirement = signal(false);
  readonly retirementMonthlyExpense = signal<number | null>(null);
  readonly retirementWithdrawalRate = signal(4);
  readonly savingRetirement = signal(false);

  // New-liability form state.
  readonly addingLiability = signal(false);
  readonly newLiabilityName = signal('');
  readonly newLiabilityType = signal<LiabilityType>('OTHER');
  readonly newLiabilityAmount = signal<number | null>(null);
  // Optional loan terms — only needed to unlock the EMI/amortization schedule.
  readonly newLiabilityInterestRate = signal<number | null>(null);
  readonly newLiabilityTenureMonths = signal<number | null>(null);
  readonly newLiabilityStartDate = signal<string>('');

  // Per-liability EMI schedule state (expand-in-place, no separate page).
  readonly expandedLiabilityId = signal<string | null>(null);
  readonly amortizationById = signal<Record<string, LiabilityAmortization>>({});
  readonly loadingAmortizationId = signal<string | null>(null);

  // Debt payoff strategy (avalanche vs snowball) state.
  readonly debtPayoffExtraBudget = signal<number>(0);
  readonly debtPayoffResult = signal<DebtPayoffStrategyResult | null>(null);
  readonly loadingDebtPayoff = signal(false);

  // New-insurance-policy form state.
  readonly addingInsurance = signal(false);
  readonly newInsuranceType = signal<InsuranceType>('HEALTH');
  readonly newInsuranceProvider = signal('');
  readonly newInsuranceSumInsured = signal<number | null>(null);
  readonly newInsuranceCoversFamily = signal(false);
  readonly newInsuranceRenewalDate = signal('');
  readonly newInsuranceNominee = signal('');

  ngOnInit(): void {
    this.load();
    this.loadLiabilities();
    this.loadInsurancePolicies();
    this.loadSettings();
    this.loadDebtPayoffStrategy();
  }

  load(): void {
    this.loading.set(true);
    this.financialHealthService.getSummary().subscribe({
      next: (result) => {
        this.summary.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err?.error?.error?.message ?? 'Failed to load financial health summary.');
      },
    });
  }

  loadLiabilities(): void {
    this.financialHealthService.listLiabilities().subscribe({
      next: (result) => this.liabilities.set(result),
      error: () => {},
    });
  }

  loadInsurancePolicies(): void {
    this.financialHealthService.listInsurancePolicies().subscribe({
      next: (result) => this.insurancePolicies.set(result),
      error: () => {},
    });
  }

  loadSettings(): void {
    this.settingsService.get().subscribe({
      next: (settings) => {
        this.targetEquity.set(settings.targetEquityPercent ?? 60);
        this.targetDebt.set(settings.targetDebtPercent ?? 30);
        this.targetGold.set(settings.targetGoldPercent ?? 10);
        this.retirementMonthlyExpense.set(settings.retirementMonthlyExpense);
        this.retirementWithdrawalRate.set(settings.retirementWithdrawalRatePercent ?? 4);
      },
      error: () => {},
    });
  }

  saveTargetAllocation(): void {
    const total = this.targetEquity() + this.targetDebt() + this.targetGold();
    if (total !== 100) {
      this.toast.error('Target equity/debt/gold percentages must add up to 100%.');
      return;
    }
    this.savingTarget.set(true);
    this.settingsService
      .update({
        targetEquityPercent: this.targetEquity(),
        targetDebtPercent: this.targetDebt(),
        targetGoldPercent: this.targetGold(),
      })
      .subscribe({
        next: () => {
          this.savingTarget.set(false);
          this.editingTarget.set(false);
          this.toast.success('Target allocation updated.');
          this.load();
        },
        error: (err) => {
          this.savingTarget.set(false);
          this.toast.error(err?.error?.error?.message ?? 'Failed to update target allocation.');
        },
      });
  }

  addLiability(): void {
    const name = this.newLiabilityName().trim();
    const amount = this.newLiabilityAmount();
    if (!name || amount === null || amount < 0) {
      this.toast.error('Enter a name and a valid amount for the liability.');
      return;
    }
    const payload: CreateLiabilityPayload = {
      name,
      type: this.newLiabilityType(),
      amount,
      interestRatePercent: this.newLiabilityInterestRate(),
      principalAmount: this.newLiabilityTenureMonths() !== null ? amount : null,
      tenureMonths: this.newLiabilityTenureMonths(),
      startDate: this.newLiabilityStartDate() || null,
    };
    this.financialHealthService.createLiability(payload).subscribe({
      next: () => {
        this.newLiabilityName.set('');
        this.newLiabilityAmount.set(null);
        this.newLiabilityType.set('OTHER');
        this.newLiabilityInterestRate.set(null);
        this.newLiabilityTenureMonths.set(null);
        this.newLiabilityStartDate.set('');
        this.addingLiability.set(false);
        this.loadLiabilities();
        this.load();
        this.loadDebtPayoffStrategy();
        this.toast.success('Liability added.');
      },
      error: (err) => this.toast.error(err?.error?.error?.message ?? 'Failed to add liability.'),
    });
  }

  /** Toggles the inline EMI/amortization schedule for a liability, fetching it lazily on first expand. */
  toggleSchedule(liability: Liability): void {
    if (this.expandedLiabilityId() === liability.id) {
      this.expandedLiabilityId.set(null);
      return;
    }
    this.expandedLiabilityId.set(liability.id);
    if (this.amortizationById()[liability.id]) return;

    this.loadingAmortizationId.set(liability.id);
    this.financialHealthService.getLiabilityAmortization(liability.id).subscribe({
      next: (result) => {
        this.loadingAmortizationId.set(null);
        this.amortizationById.update((map) => ({ ...map, [liability.id]: result }));
      },
      error: (err) => {
        this.loadingAmortizationId.set(null);
        this.expandedLiabilityId.set(null);
        this.toast.error(err?.error?.error?.message ?? 'Failed to load EMI schedule.');
      },
    });
  }

  hasLoanTerms(liability: Liability): boolean {
    return liability.principalAmount !== null && liability.tenureMonths !== null && liability.startDate !== null;
  }

  /** Compares avalanche vs snowball payoff order across all loans with full terms, given the extra monthly budget entered. */
  loadDebtPayoffStrategy(): void {
    this.loadingDebtPayoff.set(true);
    this.financialHealthService.getDebtPayoffStrategy(this.debtPayoffExtraBudget() || 0).subscribe({
      next: (result) => {
        this.loadingDebtPayoff.set(false);
        this.debtPayoffResult.set(result);
      },
      error: (err) => {
        this.loadingDebtPayoff.set(false);
        this.toast.error(err?.error?.error?.message ?? 'Failed to load debt payoff strategy.');
      },
    });
  }

  excludedLiabilityNames(payoff: DebtPayoffStrategyResult): string {
    return payoff.excludedLiabilities.map((l) => l.name).join(', ');
  }

  removeLiability(liability: Liability): void {
    this.confirmDialog
      .open({
        title: 'Delete liability',
        message: `Are you sure you want to delete "${liability.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.financialHealthService.deleteLiability(liability.id).subscribe({
          next: () => {
            this.loadLiabilities();
            this.load();
            this.loadDebtPayoffStrategy();
            this.toast.success('Liability removed.');
          },
          error: (err) => this.toast.error(err?.error?.error?.message ?? 'Failed to remove liability.'),
        });
      });
  }

  saveRetirementSettings(): void {
    const rate = this.retirementWithdrawalRate();
    if (rate < 1 || rate > 20) {
      this.toast.error('Withdrawal rate should be between 1% and 20%.');
      return;
    }
    this.savingRetirement.set(true);
    this.settingsService
      .update({
        retirementMonthlyExpense: this.retirementMonthlyExpense(),
        retirementWithdrawalRatePercent: rate,
      })
      .subscribe({
        next: () => {
          this.savingRetirement.set(false);
          this.editingRetirement.set(false);
          this.toast.success('Retirement assumptions updated.');
          this.load();
        },
        error: (err) => {
          this.savingRetirement.set(false);
          this.toast.error(err?.error?.error?.message ?? 'Failed to update retirement assumptions.');
        },
      });
  }

  addInsurancePolicy(): void {
    const sumInsured = this.newInsuranceSumInsured();
    if (sumInsured === null || sumInsured < 0) {
      this.toast.error('Enter a valid sum insured amount.');
      return;
    }
    const payload: CreateInsurancePolicyPayload = {
      type: this.newInsuranceType(),
      provider: this.newInsuranceProvider().trim() || null,
      sumInsured,
      coversFamily: this.newInsuranceCoversFamily(),
      renewalDate: this.newInsuranceRenewalDate() || null,
      nominee: this.newInsuranceNominee().trim() || null,
    };
    this.financialHealthService.createInsurancePolicy(payload).subscribe({
      next: () => {
        this.newInsuranceProvider.set('');
        this.newInsuranceSumInsured.set(null);
        this.newInsuranceCoversFamily.set(false);
        this.newInsuranceType.set('HEALTH');
        this.newInsuranceRenewalDate.set('');
        this.newInsuranceNominee.set('');
        this.addingInsurance.set(false);
        this.loadInsurancePolicies();
        this.load();
        this.toast.success('Insurance policy added.');
      },
      error: (err) => this.toast.error(err?.error?.error?.message ?? 'Failed to add insurance policy.'),
    });
  }

  removeInsurancePolicy(policy: InsurancePolicy): void {
    this.confirmDialog
      .open({
        title: 'Delete insurance policy',
        message: `Are you sure you want to delete this ${this.insuranceTypeLabels[policy.type]} policy? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.financialHealthService.deleteInsurancePolicy(policy.id).subscribe({
          next: () => {
            this.loadInsurancePolicies();
            this.load();
            this.toast.success('Insurance policy removed.');
          },
          error: (err) => this.toast.error(err?.error?.error?.message ?? 'Failed to remove insurance policy.'),
        });
      });
  }

  statusIcon(status: FinancialHealthStatus): string {
    switch (status) {
      case 'good':
        return 'check_circle';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'help';
    }
  }

  ruleDataEntries(rule: FinancialHealthRule): { label: string; value: string }[] {
    return Object.entries(rule.data).map(([key, value]) => ({
      label: labelize(key),
      value: formatDataValue(key, value),
    }));
  }

  tierLegend(rule: FinancialHealthRule): TierLegendRow[] | null {
    return TIER_LEGENDS[rule.id] ?? null;
  }

  calculatorLink(ruleId: string): { slug: string; label: string } | null {
    return CALCULATOR_LINKS[ruleId] ?? null;
  }

  formatMoney(value: number | null): string {
    if (value === null) return '—';
    return formatCurrency(value, { maximumFractionDigits: 0 });
  }
}

