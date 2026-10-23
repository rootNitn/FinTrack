import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { DashboardService } from '../dashboard.service';
import { DashboardSummary } from '../dashboard.model';
import { GoalsService } from '../../goals/goals.service';
import { Goal } from '../../goals/goals.model';
import { TransactionsService } from '../../transactions/transactions.service';
import { Transaction, TransactionType } from '../../transactions/transactions.model';
import { NotificationsService } from '../../notifications/notifications.service';
import { AppNotification, NotificationType } from '../../notifications/notifications.model';
import { CHART_PALETTE } from '../../../shared/charts/chart-style.util';
import { formatCurrency, formatNumber } from '../../../shared/utils/currency.util';
import { formatDate as formatDateUtil } from '../../../shared/utils/date.util';
import { MarketRatesService } from '../market-rates.service';
import { MarketRate } from '../market-rates.model';
import { SettingsService } from '../../settings/settings.service';
import { DashboardWidgetLayout } from '../../settings/settings.model';
import { FinancialHealthService } from '../../financial-health/financial-health.service';
import { FinancialHealthSummary } from '../../financial-health/financial-health.model';
import { FinancialLevelService } from '../../financial-level/financial-level.service';
import { FinancialLevelSummary } from '../../financial-level/financial-level.model';
import { OnboardingTourService } from '../../../shared/components/onboarding-tour/onboarding-tour.service';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

/** Every customizable dashboard widget — id must match the [data-widget] wrapper in the template. */
interface DashboardWidgetDef {
  id: string;
  label: string;
}

const DEFAULT_WIDGETS: DashboardWidgetDef[] = [
  { id: 'marketRates', label: 'Market Rates' },
  { id: 'kpis', label: 'Key Metrics' },
  { id: 'netWorthCharts', label: 'Asset Allocation' },
  { id: 'cashFlowChart', label: "This Month's Cash Flow" },
  { id: 'remindersHealth', label: 'Bill Reminders & Health Score' },
  { id: 'goalsTransactions', label: 'Goal Progress & Recent Transactions' },
  { id: 'quickActions', label: 'Quick Actions' },
  { id: 'moreInsights', label: 'More Insights' },
];

const REMINDER_TYPES: NotificationType[] = ['FD_MATURITY', 'SIP_REMINDER'];
const REMINDER_ICONS: Partial<Record<NotificationType, string>> = {
  FD_MATURITY: 'savings',
  SIP_REMINDER: 'event_repeat',
};

const TRANSACTION_ICONS: Record<TransactionType, string> = {
  INVESTMENT_BUY: 'trending_up',
  INVESTMENT_SELL: 'trending_down',
  SIP: 'event_repeat',
  INCOME: 'attach_money',
  EXPENSE: 'payments',
  TRANSFER: 'swap_horiz',
};

const OUTFLOW_TYPES: TransactionType[] = ['EXPENSE', 'INVESTMENT_BUY', 'SIP'];
const INFLOW_TYPES: TransactionType[] = ['INCOME', 'INVESTMENT_SELL'];

interface QuickAction {
  label: string;
  icon: string;
  link: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Add Transaction', icon: 'receipt_long', link: '/transactions' },
  { label: 'Add Expense', icon: 'payments', link: '/expenses' },
  { label: 'Add Income', icon: 'attach_money', link: '/income' },
  { label: 'Add Investment', icon: 'trending_up', link: '/investments' },
  { label: 'Add Goal', icon: 'flag', link: '/goals' },
  { label: 'View Reports', icon: 'bar_chart', link: '/reports' },
];

const MOTIVATIONAL_QUOTES = [
  'Small, consistent investments can grow into meaningful wealth.',
  'The best investment strategy is the one you can follow consistently.',
  'Give your money a purpose, then give your plan time to work.',
  'Financial progress is built one thoughtful decision at a time.',
  'Invest in your future self with patience, discipline, and intention.',
  'Time in the market matters more than timing the market.',
  'A clear financial goal turns saving into a journey with direction.',
  'Build wealth quietly through habits that work loudly over time.',
  'Diversification helps your financial plan stay steady through change.',
  'Every contribution is a vote for the life you want to build.',
  'Patience gives good financial decisions room to compound.',
  'Know your numbers, trust your plan, and keep moving forward.',
  'The strongest portfolio is supported by the strongest financial habits.',
  'Progress does not need to be dramatic to be powerful.',
  'Your future deserves a plan today, not a promise someday.',
];

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    DragDropModule,
    NgxEchartsDirective,
    KpiCardComponent,
    ChartCardComponent,
    PageHeaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly onboardingTour = inject(OnboardingTourService);
  private readonly goalsService = inject(GoalsService);
  private readonly transactionsService = inject(TransactionsService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly authService = inject(AuthService);
  private readonly marketRatesService = inject(MarketRatesService);
  private readonly settingsService = inject(SettingsService);
  private readonly financialHealthService = inject(FinancialHealthService);
  private readonly financialLevelService = inject(FinancialLevelService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly financialHealth = signal<FinancialHealthSummary | null>(null);
  readonly financialHealthLoading = signal(true);
  readonly financialLevel = signal<FinancialLevelSummary | null>(null);

  readonly goals = signal<Goal[]>([]);
  readonly goalsLoading = signal(true);

  readonly recentTransactions = signal<Transaction[]>([]);
  readonly transactionsLoading = signal(true);

  readonly reminders = signal<AppNotification[]>([]);
  readonly remindersLoading = signal(true);

  readonly marketRates = signal<MarketRate[]>([]);
  readonly marketRatesLoading = signal(true);

  readonly isNative = Capacitor.isNativePlatform();
  readonly quickActions = this.isNative ? QUICK_ACTIONS.filter((action) => action.link !== '/reports') : QUICK_ACTIONS;
  readonly motivationQuote = signal(
    MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)],
  );

  readonly widgetLabels: Record<string, string> = Object.fromEntries(DEFAULT_WIDGETS.map((w) => [w.id, w.label]));
  /** Effective, persisted layout — defaults merged with the user's saved order/visibility. */
  readonly widgetLayout = signal<DashboardWidgetLayout[]>(DEFAULT_WIDGETS.map((w) => ({ id: w.id, visible: true })));
  /** Working copy edited in customize mode; only committed to `widgetLayout` on Save. */
  readonly draftLayout = signal<DashboardWidgetLayout[]>([]);
  readonly editMode = signal(false);
  readonly savingLayout = signal(false);

  readonly kpis = computed(() => this.summary()?.kpis ?? null);
  readonly financialSnapshot = computed(() => {
    const kpis = this.kpis();
    const health = this.financialHealth();
    if (!kpis) return null;
    const monthlyNet = kpis.monthlyIncome - kpis.monthlyExpenses;
    return {
      netWorth: kpis.netWorth,
      monthlyNet,
      investments: kpis.currentValue,
      cash: kpis.cashAvailable,
      debt: health?.netWorth.totalLiabilities ?? null,
      savingsRate: kpis.monthlyIncome > 0 ? (monthlyNet / kpis.monthlyIncome) * 100 : null,
    };
  });

  readonly financialHealthCategories = [
    { key: 'savings', label: 'Savings' },
    { key: 'debt', label: 'Debt' },
    { key: 'investments', label: 'Investments' },
    { key: 'emergencyFund', label: 'Emergency Fund' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'goals', label: 'Goals' },
    { key: 'credit', label: 'Credit' },
  ] as const;

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    const firstName = this.authService.currentUser()?.name?.split(' ')[0];
    return firstName ? `Good ${timeOfDay}, ${firstName}` : `Good ${timeOfDay}`;
  });

  // Sourced from the financial-health module so the dashboard gauge always matches the
  // /financial-health page's overall score — avoids two different scoring formulas diverging.
  readonly healthScore = computed<number | null>(() => this.financialHealth()?.overallScore ?? null);

  readonly healthScoreLabel = computed(() => {
    const status = this.financialHealth()?.overallStatus;
    if (!status || status === 'na') return this.healthScore() === null ? '' : 'Not Enough Data';
    if (status === 'good') return 'Good';
    if (status === 'warning') return 'Needs Attention';
    return 'At Risk';
  });

  readonly healthScoreColor = computed(() => {
    const status = this.financialHealth()?.overallStatus;
    if (status === 'good') return '#22c55e';
    if (status === 'warning') return '#f59e0b';
    if (status === 'critical') return '#f43f5e';
    return '#6366f1';
  });

  readonly healthScoreOptions = computed<EChartsCoreOption | null>(() => {
    const score = this.healthScore();
    if (score === null) return null;
    const color = this.healthScoreColor();
    return {
      series: [
        {
          type: 'gauge',
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          splitNumber: 5,
          radius: '90%',
          progress: { show: true, width: 14, itemStyle: { color } },
          axisLine: { lineStyle: { width: 14, color: [[1, 'rgba(148,163,184,0.25)']] } },
          axisTick: { show: false },
          splitLine: { length: 12, lineStyle: { width: 2, color: '#fff' } },
          axisLabel: { distance: 18, fontSize: 11, color: '#9ca3af' },
          pointer: {
            show: true,
            length: '60%',
            width: 5,
            itemStyle: { color },
          },
          anchor: { show: true, size: 12, itemStyle: { color, borderColor: '#fff', borderWidth: 2 } },
          title: { show: false },
          detail: {
            valueAnimation: true,
            fontSize: 32,
            fontWeight: 700,
            offsetCenter: [0, '35%'],
            formatter: '{value}',
            color,
          },
          data: [{ value: score }],
        },
      ],
    };
  });

  readonly assetAllocationOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.summary()?.charts.assetAllocation;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'item', valueFormatter: (v: unknown) => currency(v as number) },
      legend: { bottom: 0 },
      color: CHART_PALETTE,
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { formatter: '{b}\n{d}%' },
          emphasis: { scale: true, scaleSize: 6 },
          data: data.map((d) => ({ name: d.name, value: d.value })),
        },
      ],
    };
  });

  // Net Worth Over Time was removed from the Dashboard — it duplicates Analytics' Net Worth
  // Growth chart exactly (feature overlap audit, 2026-08-10). Dashboard keeps only the KPI number.

  readonly currentVsTargetOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.summary()?.charts.currentVsTarget;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => currency(v as number) },
      legend: { bottom: 0 },
      grid: { left: 8, right: 16, top: 16, bottom: 32, containLabel: true },
      xAxis: { type: 'category', data: data.map((d) => d.category) },
      yAxis: { type: 'value' },
      series: [
        { name: 'Current', type: 'bar', itemStyle: { color: '#6366f1', borderRadius: [6, 6, 0, 0] }, data: data.map((d) => d.current) },
        { name: 'Target', type: 'bar', itemStyle: { color: '#22c55e', borderRadius: [6, 6, 0, 0] }, data: data.map((d) => d.target) },
      ],
    };
  });

  readonly profitByCategoryOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.summary()?.charts.profitByCategory;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => currency(v as number) },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: data.map((d) => d.category) },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          itemStyle: { borderRadius: [6, 6, 0, 0] },
          data: data.map((d) => ({ value: d.profit, itemStyle: { color: d.profit >= 0 ? '#16a34a' : '#dc2626' } })),
        },
      ],
    };
  });

  readonly monthlyInvestmentTrendOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.summary()?.charts.monthlyInvestmentTrend;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => currency(v as number) },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: data.map((d) => d.label) },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', itemStyle: { color: '#6366f1', borderRadius: [6, 6, 0, 0] }, data: data.map((d) => d.amount) }],
    };
  });

  readonly expenseBreakdownOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.summary()?.charts.expenseBreakdown;
    if (!data?.length) return null;
    return {
      tooltip: { trigger: 'item', valueFormatter: (v: unknown) => currency(v as number) },
      legend: { bottom: 0 },
      color: CHART_PALETTE,
      series: [
        {
          type: 'pie',
          radius: '68%',
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { formatter: '{b}\n{d}%' },
          emphasis: { scale: true, scaleSize: 6 },
          data: data.map((d) => ({ name: d.name, value: d.value })),
        },
      ],
    };
  });

  // Multi-month "Monthly Cash Flow" chart was replaced by a current-month-only summary — the
  // multi-month trend already lives in Analytics' Income vs Expense chart (feature overlap audit, 2026-08-10).
  readonly currentMonthCashFlow = computed(() => {
    const data = this.summary()?.charts.incomeVsExpense;
    return data?.length ? data[data.length - 1] : null;
  });

  readonly portfolioTrendLabel = computed(() => {
    const k = this.kpis();
    if (!k) return null;
    return `${currency(k.totalProfit)} profit, ${k.roiPercent}% ROI`;
  });

  readonly topInvestmentsOptions = computed<EChartsCoreOption | null>(() => {
    const data = this.summary()?.charts.topInvestments;
    if (!data?.length) return null;
    const sorted = [...data].reverse();
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => currency(v as number) },
      grid: { left: '25%', right: 16, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: sorted.map((d) => d.name) },
      series: [{ type: 'bar', itemStyle: { color: '#8b5cf6', borderRadius: [0, 6, 6, 0] }, data: sorted.map((d) => d.currentValue) }],
    };
  });

  readonly currencyFormat = currency;

  constructor() {
    this.load();
    this.loadGoals();
    this.loadRecentTransactions();
    this.loadReminders();
    this.loadMarketRates();
    this.loadLayout();
    this.loadFinancialHealth();
    this.loadFinancialLevel();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.dashboardService.getSummary().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load dashboard data.');
        this.loading.set(false);
      },
    });
  }

  loadGoals(): void {
    this.goalsLoading.set(true);
    this.goalsService.list().subscribe({
      next: (goals) => {
        this.goals.set(goals);
        this.goalsLoading.set(false);
      },
      error: () => this.goalsLoading.set(false),
    });
  }

  loadRecentTransactions(): void {
    this.transactionsLoading.set(true);
    this.transactionsService.recent(5).subscribe({
      next: (transactions) => {
        this.recentTransactions.set(transactions);
        this.transactionsLoading.set(false);
      },
      error: () => this.transactionsLoading.set(false),
    });
  }

  loadReminders(): void {
    this.remindersLoading.set(true);
    this.notificationsService.list(false).subscribe({
      next: (notifications) => {
        this.reminders.set(
          notifications.filter((n) => REMINDER_TYPES.includes(n.type)).slice(0, 5)
        );
        this.remindersLoading.set(false);
      },
      error: () => this.remindersLoading.set(false),
    });
  }

  loadMarketRates(): void {
    this.marketRatesLoading.set(true);
    this.marketRatesService.list().subscribe({
      next: (rates) => {
        this.marketRates.set(rates);
        this.marketRatesLoading.set(false);
      },
      error: () => this.marketRatesLoading.set(false),
    });
  }

  loadFinancialHealth(): void {
    this.financialHealthLoading.set(true);
    this.financialHealthService.getSummary().subscribe({
      next: (result) => {
        this.financialHealth.set(result);
        this.financialHealthLoading.set(false);
      },
      error: () => {
        this.financialHealth.set(null);
        this.financialHealthLoading.set(false);
      },
    });
  }

  loadFinancialLevel(): void {
    this.financialLevelService.getSummary().subscribe({
      next: (result) => this.financialLevel.set(result),
      error: () => this.financialLevel.set(null),
    });
  }

  /** Loads the user's saved widget layout, appending any newer default widgets they haven't seen yet. */
  loadLayout(): void {
    this.settingsService.get().subscribe({
      next: (settings) => {
        const saved = settings.dashboardLayout ?? [];
        if (saved.length === 0) {
          this.widgetLayout.set(DEFAULT_WIDGETS.map((w) => ({ id: w.id, visible: true })));
          return;
        }
        const savedIds = new Set(saved.map((w) => w.id));
        const missingDefaults = DEFAULT_WIDGETS.filter((w) => !savedIds.has(w.id)).map((w) => ({ id: w.id, visible: true }));
        this.widgetLayout.set([...saved, ...missingDefaults]);
      },
      error: () => {
        // Keep the built-in default layout if settings can't be loaded.
      },
    });
  }

  isWidgetVisible(id: string): boolean {
    return this.widgetLayout().find((w) => w.id === id)?.visible ?? true;
  }

  widgetOrder(id: string): number {
    const index = this.widgetLayout().findIndex((w) => w.id === id);
    return index === -1 ? 999 : index;
  }

  startCustomize(): void {
    this.draftLayout.set(this.widgetLayout().map((w) => ({ ...w })));
    this.editMode.set(true);
  }

  restartOnboardingTour(): void {
    this.onboardingTour.restart();
  }

  cancelCustomize(): void {
    this.editMode.set(false);
    this.draftLayout.set([]);
  }

  toggleDraftVisible(id: string): void {
    this.draftLayout.update((layout) => layout.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  }

  dropDraftWidget(event: CdkDragDrop<DashboardWidgetLayout[]>): void {
    this.draftLayout.update((layout) => {
      const next = [...layout];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return next;
    });
  }

  saveLayout(): void {
    this.savingLayout.set(true);
    this.settingsService.update({ dashboardLayout: this.draftLayout() }).subscribe({
      next: () => {
        this.widgetLayout.set(this.draftLayout());
        this.savingLayout.set(false);
        this.editMode.set(false);
        this.toast.success('Dashboard layout saved.');
      },
      error: () => {
        this.savingLayout.set(false);
        this.toast.error('Failed to save dashboard layout.');
      },
    });
  }

  resetLayout(): void {
    this.draftLayout.set(DEFAULT_WIDGETS.map((w) => ({ id: w.id, visible: true })));
  }

  rateValue(rate: MarketRate): string {
    return rate.unit === 'index' ? formatNumber(rate.price, { maximumFractionDigits: 2 }) : currency(rate.price);
  }

  rateTrend(rate: MarketRate): 'up' | 'down' | 'neutral' {
    if (rate.changeAmount > 0) return 'up';
    if (rate.changeAmount < 0) return 'down';
    return 'neutral';
  }

  rateChangeLabel(rate: MarketRate): string {
    const sign = rate.changeAmount >= 0 ? '+' : '';
    const changeAmount = rate.unit === 'index' ? formatNumber(rate.changeAmount, { maximumFractionDigits: 2 }) : currency(rate.changeAmount);
    return `${sign}${changeAmount} (${sign}${rate.changePercent.toFixed(2)}%)`;
  }

  rateIcon(rate: MarketRate): string {
    return rate.unit === 'index' ? 'show_chart' : 'savings';
  }

  reminderIcon(type: NotificationType): string {
    return REMINDER_ICONS[type] ?? 'notifications';
  }

  transactionIcon(type: TransactionType): string {
    return TRANSACTION_ICONS[type] ?? 'receipt_long';
  }

  transactionAmountClass(type: TransactionType): string {
    if (OUTFLOW_TYPES.includes(type)) return 'text-loss';
    if (INFLOW_TYPES.includes(type)) return 'text-profit';
    return '';
  }

  transactionAmountPrefix(type: TransactionType): string {
    if (OUTFLOW_TYPES.includes(type)) return '-';
    if (INFLOW_TYPES.includes(type)) return '+';
    return '';
  }

  goalProgressColor(percent: number): string {
    if (percent >= 75) return '#22c55e';
    if (percent >= 40) return '#6366f1';
    return '#f59e0b';
  }

  formatDate(value: string): string {
    return formatDateUtil(value);
  }
}

