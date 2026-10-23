import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import type { EChartsCoreOption } from 'echarts/core';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card.component';
import { CHART_PALETTE, gradientFill } from '../../shared/charts/chart-style.util';
import { RevealOnScrollDirective } from './reveal-on-scroll.directive';
import { COMPARISON_ROWS, FAQ_ITEMS, FEATURE_CARDS, PAID_PLAN_CHECKOUT_ENABLED, PRICING_PLANS, PricingPlan, yearlySavingsPercent } from './landing.config';

type BillingCycle = 'monthly' | 'yearly';

interface AiDemoMessage {
  role: 'user' | 'ai';
  text: string;
}

/** Formats a rupee amount compactly in Indian lakh/crore notation for demo figures (e.g. ₹50.97L). */
function formatCompactInr(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)}L`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, ChartCardComponent, RevealOnScrollDirective],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements OnInit, OnDestroy {
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private structuredDataScript?: HTMLScriptElement;

  readonly appName = 'LifeTrack';

  readonly scrolled = signal(false);
  readonly mobileMenuOpen = signal(false);
  readonly billingCycle = signal<BillingCycle>('monthly');
  readonly openFaqIndex = signal<number | null>(0);

  readonly pricingPlans = PRICING_PLANS;
  readonly paidPlanCheckoutEnabled = PAID_PLAN_CHECKOUT_ENABLED;
  readonly comparisonRows = COMPARISON_ROWS;
  readonly featureCards = FEATURE_CARDS;
  readonly faqItems = FAQ_ITEMS;

  readonly formatCompactInr = formatCompactInr;

  // ---- Demo data (clearly labelled as such in the template — never real user data) ----
  readonly demoFinancialProgress = {
    score: 68,
    level: 'Financially Secure',
    nextMilestone: 'Financially Strong',
    incomeDiversification: 74,
    savingsRate: 31,
    emergencyFundMonths: 5.2,
    passiveIncomeMonthly: 18_000,
    investmentGrowthPercent: 14.2,
  };

  readonly demoIncomeSources = [
    { label: 'Salary', percent: 72 },
    { label: 'Freelancing', percent: 12 },
    { label: 'Rental', percent: 8 },
    { label: 'Investments', percent: 8 },
  ];

  readonly demoInvestments = {
    total: 50_97_000,
    invested: 43_20_000,
    currentValue: 50_97_000,
    gain: 7_77_000,
    roiPercent: 18.0,
  };

  readonly demoGoal = {
    name: 'Dream Home',
    target: 30_00_000,
    saved: 12_50_000,
    progressPercent: 41.7,
    targetYear: 2029,
    monthlyContribution: 35_000,
  };

  readonly demoAiConversation: AiDemoMessage[] = [
    { role: 'user', text: 'Where am I spending too much?' },
    { role: 'ai', text: 'Dining out is 22% of this month\u2019s spend, up from 14% last month — the largest increase across all categories.' },
    { role: 'user', text: 'How diversified is my income?' },
    { role: 'ai', text: 'Salary makes up 72% of your income. Diversifying further would reduce your dependency on a single source.' },
  ];

  readonly howItWorksSteps = [
    { step: '01', title: 'Create your account', description: 'Sign up in under a minute — no credit card required.' },
    { step: '02', title: 'Add or import your financial data', description: 'Record income, expenses and investments, or import holdings from supported sources.' },
    { step: '03', title: 'Understand your financial position', description: 'See net worth, financial health and progress calculated automatically.' },
    { step: '04', title: 'Build your financial roadmap', description: 'Set goals, track progress, and let the AI assistant explain what to focus on next.' },
  ];

  readonly trustPoints = [
    { icon: 'lock', title: 'Secure', description: 'Encrypted connections, hashed passwords and token-based sessions.' },
    { icon: 'visibility_off', title: 'Private', description: 'Your financial data is isolated to your account.' },
    { icon: 'auto_awesome', title: 'Simple', description: 'One dashboard instead of scattered apps and spreadsheets.' },
    { icon: 'bolt', title: 'Powerful', description: 'Expense tracking, investing, planning and AI insight in one place.' },
  ];

  readonly securityMechanisms = [
    { icon: 'password', title: 'Secure authentication', description: 'Passwords are hashed with bcrypt before storage — the plain password is never saved.' },
    { icon: 'https', title: 'Encrypted connections', description: 'All traffic is served over HTTPS in production, with security headers applied to every response.' },
    { icon: 'vpn_key', title: 'Token-based sessions', description: 'Short-lived access tokens plus rotating refresh tokens are used instead of long-lived static sessions.' },
    { icon: 'shield', title: 'Access control', description: 'Every request is authorized against the signed-in account, and admin-only areas are separately protected.' },
    { icon: 'folder_shared', title: 'Data isolation', description: 'Each account only ever reads or writes its own records — never another user\u2019s data.' },
    { icon: 'enhanced_encryption', title: 'Sensitive-data protection', description: 'Fields such as bank account and card numbers are encrypted at rest, not stored as plain text.' },
    { icon: 'speed', title: 'Abuse protection', description: 'Login, signup and password-reset endpoints are rate-limited to slow down automated abuse.' },
  ];

  readonly beforeItems = ['Expense apps', 'Spreadsheets', 'Notes', 'Bank statements', 'Investment apps'];

  ngOnInit(): void {
    this.setSeoMetadata();
    this.injectStructuredData();
  }

  ngOnDestroy(): void {
    this.structuredDataScript?.remove();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.scrolled.set((window.scrollY || this.document.documentElement.scrollTop) > 12);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  setBillingCycle(cycle: BillingCycle): void {
    this.billingCycle.set(cycle);
  }

  toggleFaq(index: number): void {
    this.openFaqIndex.update((current) => (current === index ? null : index));
  }

  planPriceLabel(plan: PricingPlan): string {
    if (plan.monthlyPrice <= 0) return '₹0';
    const amount = this.billingCycle() === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  }

  planPeriodLabel(plan: PricingPlan): string {
    if (plan.monthlyPrice <= 0) return '/ month';
    return this.billingCycle() === 'yearly' ? '/ year' : '/ month';
  }

  planSavingsLabel(plan: PricingPlan): string | null {
    if (this.billingCycle() !== 'yearly') return null;
    const percent = yearlySavingsPercent(plan);
    return percent ? `Save ${percent}% vs. monthly` : null;
  }

  private setSeoMetadata(): void {
    const title = `${this.appName} — Your Personal Financial Command Center`;
    const description = 'Track your income, expenses, investments, goals, net worth and financial progress in one place.';
    this.titleService.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
  }

  private injectStructuredData(): void {
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: this.appName,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      offers: this.pricingPlans.map((plan) => ({
        '@type': 'Offer',
        name: plan.name,
        price: plan.monthlyPrice,
        priceCurrency: 'INR',
      })),
    });
    this.document.head.appendChild(script);
    this.structuredDataScript = script;
  }

  // ---- Demo chart options (all data below is static demo data, not a live user's data) ----

  readonly incomeExpenseDemoOptions: EChartsCoreOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: ['Income', 'Expenses'], textStyle: { fontSize: 11 } },
    grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', show: false },
    series: [
      { name: 'Income', type: 'bar', data: [92000, 95000, 97000, 96500, 101000, 104000], itemStyle: { color: CHART_PALETTE[1], borderRadius: [4, 4, 0, 0] }, barMaxWidth: 18 },
      { name: 'Expenses', type: 'bar', data: [61000, 64000, 58000, 66000, 62000, 60000], itemStyle: { color: CHART_PALETTE[6], borderRadius: [4, 4, 0, 0] }, barMaxWidth: 18 },
    ],
  };

  readonly netWorthDemoOptions: EChartsCoreOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
        lineStyle: { width: 3, color: CHART_PALETTE[0] },
        areaStyle: { color: gradientFill(CHART_PALETTE[0]) },
        data: [3120000, 3245000, 3310000, 3402000, 3510000, 3648000],
      },
    ],
  };

  readonly expenseBreakdownDemoOptions: EChartsCoreOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { fontSize: 10 } },
    series: [
      {
        type: 'pie',
        radius: ['45%', '72%'],
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: [
          { name: 'Housing', value: 32, itemStyle: { color: CHART_PALETTE[0] } },
          { name: 'Food', value: 22, itemStyle: { color: CHART_PALETTE[1] } },
          { name: 'Transport', value: 14, itemStyle: { color: CHART_PALETTE[2] } },
          { name: 'Utilities', value: 10, itemStyle: { color: CHART_PALETTE[4] } },
          { name: 'Other', value: 22, itemStyle: { color: CHART_PALETTE[5] } },
        ],
      },
    ],
  };

  readonly savingsRateDemoOptions: EChartsCoreOption = {
    tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => `${v}%` },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}%' }, show: false },
    series: [
      {
        type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
        lineStyle: { width: 3, color: CHART_PALETTE[1] },
        areaStyle: { color: gradientFill(CHART_PALETTE[1]) },
        data: [24, 26, 29, 27, 30, 31],
      },
    ],
  };

  readonly investmentGrowthDemoOptions: EChartsCoreOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
        lineStyle: { width: 3, color: CHART_PALETTE[3] },
        areaStyle: { color: gradientFill(CHART_PALETTE[3]) },
        data: [4320000, 4455000, 4610000, 4780000, 4930000, 5097000],
      },
    ],
  };
}
