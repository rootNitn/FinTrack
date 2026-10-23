import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { ToastService } from '../../core/services/toast.service';

// Income source ids whose real-world cash flow is typically passive (mirrors financial-level.service.ts's classification).
const PASSIVE_INCOME_SOURCE_IDS = new Set(['rental', 'interest', 'dividends']);

interface GoalOption { id: string; label: string; icon: string; }
interface IncomeSourceOption { id: string; label: string; }
interface InvestmentOption { id: string; label: string; }

const GOAL_OPTIONS: GoalOption[] = [
  { id: 'save', label: 'Save Money', icon: 'savings' },
  { id: 'emergency', label: 'Build Emergency Fund', icon: 'health_and_safety' },
  { id: 'invest', label: 'Invest', icon: 'show_chart' },
  { id: 'home', label: 'Buy a Home', icon: 'home' },
  { id: 'retirement', label: 'Retirement', icon: 'beach_access' },
  { id: 'debt', label: 'Reduce Debt', icon: 'credit_card_off' },
  { id: 'track', label: 'Track Finances', icon: 'query_stats' },
  { id: 'wealth', label: 'Build Wealth', icon: 'account_balance' },
];

const INCOME_SOURCE_OPTIONS: IncomeSourceOption[] = [
  { id: 'salary', label: 'Salary' },
  { id: 'business', label: 'Business' },
  { id: 'freelance', label: 'Freelancing' },
  { id: 'rental', label: 'Rental Income' },
  { id: 'interest', label: 'Interest' },
  { id: 'dividends', label: 'Dividends' },
  { id: 'other', label: 'Other' },
];

const INVESTMENT_OPTIONS: InvestmentOption[] = [
  { id: 'mutual_funds', label: 'Mutual Funds' },
  { id: 'stocks', label: 'Stocks' },
  { id: 'fd', label: 'Fixed Deposits' },
  { id: 'ppf', label: 'PPF' },
  { id: 'epf', label: 'EPF' },
  { id: 'nps', label: 'NPS' },
  { id: 'gold', label: 'Gold' },
  { id: 'none', label: 'None yet' },
];

const TOTAL_STEPS = 6;

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
})
export class OnboardingComponent {
  private readonly router = inject(Router);
  private readonly api = inject(ApiBaseService);
  private readonly toast = inject(ToastService);
  private submitting = false;

  readonly goalOptions = GOAL_OPTIONS;
  readonly incomeSourceOptions = INCOME_SOURCE_OPTIONS;
  readonly investmentOptions = INVESTMENT_OPTIONS;
  readonly totalSteps = TOTAL_STEPS;

  readonly step = signal(1);
  readonly completed = signal(false);

  readonly selectedGoal = signal<string | null>(null);
  readonly selectedIncomeSources = signal<Set<string>>(new Set());
  readonly monthlyIncome = signal<number | null>(null);
  readonly monthlyExpenses = signal<number | null>(null);
  readonly selectedInvestments = signal<Set<string>>(new Set());
  readonly primaryGoalText = signal('');

  readonly progressPercent = computed(() => (this.step() / this.totalSteps) * 100);

  readonly canContinue = computed(() => {
    switch (this.step()) {
      case 1: return !!this.selectedGoal();
      case 2: return this.selectedIncomeSources().size > 0;
      case 3: return this.monthlyIncome() !== null && this.monthlyIncome()! >= 0;
      case 4: return this.monthlyExpenses() !== null && this.monthlyExpenses()! >= 0;
      case 5: return this.selectedInvestments().size > 0;
      case 6: return true;
      default: return true;
    }
  });

  toggleGoal(id: string): void {
    this.selectedGoal.set(id);
  }

  toggleIncomeSource(id: string): void {
    this.selectedIncomeSources.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  toggleInvestment(id: string): void {
    this.selectedInvestments.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  setMonthlyIncome(value: string): void {
    const parsed = Number(value);
    this.monthlyIncome.set(Number.isFinite(parsed) && value !== '' ? parsed : null);
  }

  setMonthlyExpenses(value: string): void {
    const parsed = Number(value);
    this.monthlyExpenses.set(Number.isFinite(parsed) && value !== '' ? parsed : null);
  }

  next(): void {
    if (!this.canContinue()) return;
    if (this.step() >= this.totalSteps) {
      this.completed.set(true);
      this.submitOnboardingData();
      return;
    }
    this.step.update((s) => s + 1);
  }

  /** Best-effort save of the concrete numbers the user entered — reuses the existing Income
   * Sources and Budgets APIs instead of fabricating Goal/Investment records we lack real
   * target/holding data for. Never blocks navigation to the dashboard on failure. */
  private submitOnboardingData(): void {
    if (this.submitting) return;
    this.submitting = true;

    const sourceIds = Array.from(this.selectedIncomeSources());
    const sourceLabels = sourceIds.map((id) => this.incomeSourceOptions.find((o) => o.id === id)?.label ?? id);
    const goalLabel = this.goalOptions.find((o) => o.id === this.selectedGoal())?.label ?? '';
    const investmentLabels = Array.from(this.selectedInvestments())
      .map((id) => this.investmentOptions.find((o) => o.id === id)?.label ?? id)
      .filter((label) => label !== 'None yet');
    const notes = [
      goalLabel ? `Primary goal: ${goalLabel}${this.primaryGoalText().trim() ? ' — ' + this.primaryGoalText().trim() : ''}.` : '',
      investmentLabels.length ? `Investment interests: ${investmentLabels.join(', ')}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const requests: Record<string, ReturnType<ApiBaseService['post']>> = {};

    if (this.monthlyIncome() !== null && sourceIds.length) {
      requests['income'] = this.api.post('/income-sources', {
        name: 'Onboarding income estimate',
        type: sourceLabels.join(', ').slice(0, 60) || 'other',
        incomeMode: PASSIVE_INCOME_SOURCE_IDS.has(sourceIds[0]) ? 'PASSIVE' : 'ACTIVE',
        monthlyAverageAmount: this.monthlyIncome(),
        frequency: 'MONTHLY',
        startDate: new Date().toISOString(),
        notes: notes || null,
      });
    }

    if (this.monthlyExpenses() !== null) {
      const now = new Date();
      requests['budget'] = this.api.post('/budgets', {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        amount: this.monthlyExpenses(),
      });
    }

    if (!Object.keys(requests).length) {
      this.submitting = false;
      return;
    }

    forkJoin(requests).subscribe({
      next: () => {
        this.submitting = false;
        this.toast.success('Your income and budget estimate have been saved to get you started.');
      },
      error: () => {
        this.submitting = false;
        this.toast.error('Could not save your onboarding answers — you can add them later from Income Sources / Budgets.');
      },
    });
  }

  back(): void {
    if (this.step() > 1) this.step.update((s) => s - 1);
  }

  skip(): void {
    this.goToDashboard();
  }

  goToDashboard(): void {
    this.router.navigateByUrl('/dashboard');
  }
}
