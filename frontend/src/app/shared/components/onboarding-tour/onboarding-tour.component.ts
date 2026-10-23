import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { OnboardingTourService } from './onboarding-tour.service';

interface TourStep {
  eyebrow: string;
  title: string;
  description: string;
  requirements: string[];
  icon: string;
  route?: string;
  action?: string;
  target?: string;
  targetDescription: string;
}

@Component({
  selector: 'app-onboarding-tour',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './onboarding-tour.component.html',
  styleUrl: './onboarding-tour.component.scss',
})
export class OnboardingTourComponent {
  private readonly authService = inject(AuthService);
  private readonly tourService = inject(OnboardingTourService);
  private readonly router = inject(Router);
  private readonly tourStoragePrefix = 'ft:onboarding-completed:';

  readonly isOpen = signal(false);
  readonly stepIndex = signal(0);
  readonly currentStep = computed(() => this.steps[this.stepIndex()]);
  readonly progress = computed(() => ((this.stepIndex() + 1) / this.steps.length) * 100);
  private highlightedTarget: HTMLElement | null = null;

  readonly steps: TourStep[] = [
    {
      eyebrow: 'Start here',
      title: 'Set up your profile',
      description: 'Keep your account details current so reminders and personal insights are useful.',
      requirements: ['Your name and email are already saved', 'Add your date of birth for birthday reminders', 'Choose an avatar if you want a personal touch'],
      icon: 'person',
      route: '/profile',
      action: 'Open profile',
      target: 'profile-edit',
      targetDescription: 'On the Profile page, click Edit profile to add or change your details.',
    },
    {
      eyebrow: 'Foundation',
      title: 'Add your bank accounts',
      description: 'Bank accounts let LifeTrack keep balances accurate when you record income and expenses.',
      requirements: ['Bank name and account type', 'Current balance', 'Optional account number details'],
      icon: 'account_balance',
      route: '/banks',
      action: 'Add a bank account',
      target: 'bank-add',
      targetDescription: 'On the Bank Accounts page, click Add Bank Account.',
    },
    {
      eyebrow: 'Cash flow',
      title: 'Record your income',
      description: 'Add salary, freelance work, or other receipts to see your real savings rate.',
      requirements: ['Income source', 'Amount and date received', 'Optional bank account and family member'],
      icon: 'attach_money',
      route: '/income',
      action: 'Add income',
      target: 'income-add',
      targetDescription: 'On the Income page, click Add Income.',
    },
    {
      eyebrow: 'Cash flow',
      title: 'Track your expenses',
      description: 'Capture everyday spending so budgets, trends, and financial health scores have data to work with.',
      requirements: ['Category, amount, date, and payment mode', 'Optional description, receipt, or family member', 'Create a recurring entry for regular bills'],
      icon: 'payments',
      route: '/expenses',
      action: 'Add an expense',
      target: 'expense-add',
      targetDescription: 'On the Expenses page, click Add Expense.',
    },
    {
      eyebrow: 'Wealth',
      title: 'Build your investment picture',
      description: 'Add existing holdings as well as new investments to track value, returns, risk, and goals.',
      requirements: ['Investment name and category', 'Principal, current value, and purchase date', 'Optional symbol, units, goal, and maturity date'],
      icon: 'trending_up',
      route: '/investments',
      action: 'Add an investment',
      target: 'investment-add',
      targetDescription: 'On the Investments page, click Add Investment.',
    },
    {
      eyebrow: 'Planning',
      title: 'Create a goal',
      description: 'Turn a plan into something measurable with a target amount, deadline, and contributions.',
      requirements: ['Goal name and target amount', 'Target date', 'Link investments or contribute manually'],
      icon: 'flag',
      route: '/goals',
      action: 'Create a goal',
      target: 'goal-add',
      targetDescription: 'On the Goals page, click Add Goal.',
    },
    {
      eyebrow: 'Explore next',
      title: 'Make LifeTrack work harder for you',
      description: 'Once your basics are in place, these areas turn your entries into decisions and reminders.',
      requirements: ['Reports and Analytics: understand patterns', 'Financial Health and AI Features: find opportunities', 'Income Tax and Health: organize wider planning'],
      icon: 'auto_awesome',
      route: '/dashboard',
      action: 'Go to dashboard',
      targetDescription: 'Use the sidebar to explore the other sections whenever you are ready.',
    },
  ];

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => this.highlightCurrentTarget());

    effect(() => {
      const restartRequest = this.tourService.restartRequest();
      const userId = this.getCurrentUserId();
      if (!userId) return;
      if (restartRequest > 0) {
        this.clearTargetHighlight();
        this.stepIndex.set(0);
        this.isOpen.set(true);
        queueMicrotask(() => this.highlightCurrentTarget());
        return;
      }
      if (this.hasCompleted(userId)) return;
      if (!this.isOpen()) {
        queueMicrotask(() => this.clearTargetHighlight());
        queueMicrotask(() => this.isOpen.set(true));
        return;
      }
      this.stepIndex();
      queueMicrotask(() => this.highlightCurrentTarget());
    });
  }

  private highlightCurrentTarget(): void {
    queueMicrotask(() => {
      this.clearTargetHighlight();
      const target = this.currentStep().target;
      if (!this.isOpen() || !target) return;

      const element = document.querySelector<HTMLElement>(`[data-tour-target="${target}"]`);
      if (!element) return;
      element.classList.add('onboarding-tour-target');
      this.highlightedTarget = element;
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    });
  }

  private clearTargetHighlight(): void {
    if (this.highlightedTarget) {
      this.highlightedTarget.classList.remove('onboarding-tour-target');
      this.highlightedTarget = null;
    }
  }

  private complete(): void {
    this.clearTargetHighlight();
    const userId = this.getCurrentUserId();
    if (userId) {
      try {
        localStorage.setItem(`${this.tourStoragePrefix}${userId}`, 'true');
      } catch {
        // Keep the tour usable when browser storage is unavailable.
      }
    }
    this.isOpen.set(false);
  }

  skip(): void {
    this.complete();
  }

  next(): void {
    if (this.stepIndex() === this.steps.length - 1) {
      this.complete();
      return;
    }
    this.stepIndex.update((index) => index + 1);
  }

  previous(): void {
    this.stepIndex.update((index) => Math.max(0, index - 1));
  }

  openStep(): void {
    const route = this.currentStep().route;
    if (route) this.router.navigateByUrl(route);
  }

  private hasCompleted(userId: string): boolean {
    try {
      return localStorage.getItem(`${this.tourStoragePrefix}${userId}`) === 'true';
    } catch {
      return false;
    }
  }

  private getCurrentUserId(): string | null {
    return this.authService.currentUser()?.id ?? null;
  }
}
