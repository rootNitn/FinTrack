import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { guestGuard } from './core/guards/guest.guard';
import { planGuard } from './core/guards/plan.guard';
import { ShellComponent } from './layout/shell/shell.component';

/** Redirects a marketing-page path (e.g. /pricing) to the single-page landing route + anchor. */
function landingSectionRedirect(fragment: string) {
  return () => inject(Router).createUrlTree(['/'], { fragment });
}

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  { path: 'login', pathMatch: 'full', redirectTo: 'auth/login' },
  { path: 'signup', pathMatch: 'full', redirectTo: 'auth/register' },
  { path: 'forgot-password', pathMatch: 'full', redirectTo: 'auth/forgot-password' },
  { path: 'features', pathMatch: 'full', canActivate: [landingSectionRedirect('features')], children: [] },
  { path: 'pricing', pathMatch: 'full', canActivate: [landingSectionRedirect('pricing')], children: [] },
  { path: 'security', pathMatch: 'full', canActivate: [landingSectionRedirect('security')], children: [] },
  { path: 'faq', pathMatch: 'full', canActivate: [landingSectionRedirect('faq')], children: [] },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () => import('./features/onboarding/onboarding.component').then((m) => m.OnboardingComponent),
  },
  {
    path: 'auth',
    // Feature auth routes (login/register/forgot-password/etc.) are added in a later phase.
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'investments',
        loadComponent: () =>
          import('./features/investments/investment-list/investment-list.component').then((m) => m.InvestmentListComponent),
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('./features/transactions/transaction-list/transaction-list.component').then(
            (m) => m.TransactionListComponent
          ),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/calendar/calendar.component').then(
            (m) => m.CalendarComponent
          ),
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('./features/expenses/expense-list/expense-list.component').then((m) => m.ExpenseListComponent),
      },
      {
        path: 'income',
        loadComponent: () => import('./features/income/income-list/income-list.component').then((m) => m.IncomeListComponent),
      },
      {
        path: 'banks/:id',
        loadComponent: () => import('./features/banks/bank-detail/bank-detail.component').then((m) => m.BankDetailComponent),
      },
      {
        path: 'banks',
        loadComponent: () => import('./features/banks/bank-list/bank-list.component').then((m) => m.BankListComponent),
      },
      {
        path: 'credit-cards',
        loadComponent: () =>
          import('./features/credit-cards/credit-card-list/credit-card-list.component').then((m) => m.CreditCardListComponent),
      },
      {
        path: 'credit-cards/:id',
        loadComponent: () =>
          import('./features/credit-cards/credit-card-detail/credit-card-detail.component').then((m) => m.CreditCardDetailComponent),
      },
      {
        path: 'goals',
        loadComponent: () => import('./features/goals/goal-list/goal-list.component').then((m) => m.GoalListComponent),
      },
      {
        path: 'family-members',
        loadComponent: () =>
          import('./features/family-members/family-member-list/family-member-list.component').then(
            (m) => m.FamilyMemberListComponent
          ),
      },
      {
        path: 'billing/upgrade',
        loadComponent: () =>
          import('./features/billing/billing-upgrade/billing-upgrade.component').then((m) => m.BillingUpgradeComponent),
      },
      {
        path: 'reports',
        canActivate: [planGuard('PLUS')],
        loadComponent: () => import('./features/reports/report-view/report-view.component').then((m) => m.ReportViewComponent),
      },
      {
        path: 'calculators',
        loadComponent: () =>
          import('./features/calculators/calculator-list/calculator-list.component').then((m) => m.CalculatorListComponent),
      },
      {
        path: 'calculators/hra',
        canActivate: [planGuard('PRO')],
        loadComponent: () =>
          import('./features/calculators/hra-calculator/hra-calculator.component').then((m) => m.HraCalculatorComponent),
      },
      {
        path: 'calculators/gratuity',
        canActivate: [planGuard('PRO')],
        loadComponent: () =>
          import('./features/calculators/gratuity-calculator/gratuity-calculator.component').then((m) => m.GratuityCalculatorComponent),
      },
      {
        path: 'calculators/leave-encashment',
        canActivate: [planGuard('PRO')],
        loadComponent: () =>
          import('./features/calculators/leave-encashment-calculator/leave-encashment-calculator.component').then(
            (m) => m.LeaveEncashmentCalculatorComponent
          ),
      },
      {
        path: 'calculators/:slug',
        loadComponent: () =>
          import('./features/calculators/calculator-detail/calculator-detail.component').then((m) => m.CalculatorDetailComponent),
      },
      {
        path: 'investment-comparison',
        canActivate: [planGuard('PLUS')],
        loadComponent: () =>
          import('./features/investment-comparison/investment-comparison.component').then((m) => m.InvestmentComparisonComponent),
      },
      {
        path: 'mutual-funds',
        loadComponent: () =>
          import('./features/mutual-funds/mutual-funds.component').then((m) => m.MutualFundsComponent),
      },
      {
        path: 'stocks',
        data: { category: 'STOCKS' },
        loadComponent: () => import('./features/asset-dashboard/asset-dashboard.component').then((m) => m.AssetDashboardComponent),
      },
      {
        path: 'crypto',
        data: { category: 'CRYPTO' },
        loadComponent: () => import('./features/asset-dashboard/asset-dashboard.component').then((m) => m.AssetDashboardComponent),
      },
      {
        path: 'mutual-funds/:key',
        loadComponent: () =>
          import('./features/mutual-funds/mutual-fund-detail/mutual-fund-detail.component').then((m) => m.MutualFundDetailComponent),
      },
      {
        path: 'ai-insights',
        canActivate: [planGuard('PRO')],
        loadComponent: () => import('./features/ai-insights/ai-insights.component').then((m) => m.AiInsightsComponent),
      },
      {
        path: 'financial-health',
        canActivate: [planGuard('PLUS')],
        loadComponent: () =>
          import('./features/financial-health/financial-health.component').then((m) => m.FinancialHealthComponent),
      },
      {
        path: 'financial-level',
        canActivate: [planGuard('PLUS')],
        loadComponent: () => import('./features/financial-level/financial-level.component').then((m) => m.FinancialLevelComponent),
      },
      {
        path: 'analytics',
        canActivate: [planGuard('PLUS')],
        loadComponent: () => import('./features/analytics/analytics.component').then((m) => m.AnalyticsComponent),
      },
      {
        path: 'business/journal-approvals',
        loadComponent: () => import('./features/business/journal-approvals/journal-approvals.component').then((m) => m.JournalApprovalsComponent),
      },
      {
        path: 'business',
        loadComponent: () => import('./features/business/business.component').then((m) => m.BusinessComponent),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notification-list/notification-list.component').then(
            (m) => m.NotificationListComponent
          ),
      },
      {
        path: 'upcoming-bills',
        loadComponent: () =>
          import('./features/upcoming-bills/upcoming-bills.component').then((m) => m.UpcomingBillsComponent),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/auth/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./features/auth/change-password/change-password.component').then((m) => m.ChangePasswordComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
      },
      {
        path: 'support-tickets',
        loadComponent: () =>
          import('./features/support-tickets/ticket-list/ticket-list.component').then((m) => m.TicketListComponent),
      },
      {
        path: 'support-tickets/admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/support-tickets-admin/support-tickets-admin.component').then(
            (m) => m.SupportTicketsAdminComponent
          ),
      },
      {
        path: 'fd/calculator',
        loadComponent: () => import('./features/fd/fd-calculator/fd-calculator.component').then((m) => m.FdCalculatorComponent),
      },
      {
        path: 'fd/compare',
        loadComponent: () => import('./features/fd/fd-comparison/fd-comparison.component').then((m) => m.FdComparisonComponent),
      },
      {
        path: 'fd/bank/:id',
        loadComponent: () => import('./features/fd/fd-bank-detail/fd-bank-detail.component').then((m) => m.FdBankDetailComponent),
      },
      {
        path: 'fd/ladder',
        loadComponent: () =>
          import('./features/fd/fd-ladder-planner/fd-ladder-planner.component').then((m) => m.FdLadderPlannerComponent),
      },
      {
        path: 'fd/portfolio',
        loadComponent: () =>
          import('./features/fd/fd-portfolio-list/fd-portfolio-list.component').then((m) => m.FdPortfolioListComponent),
      },
      {
        path: 'fd/admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/fd/fd-admin/fd-admin.component').then((m) => m.FdAdminComponent),
      },
      {
        path: 'tax',
        canActivate: [planGuard('PRO')],
        loadComponent: () => import('./features/tax/tax-dashboard/tax-dashboard.component').then((m) => m.TaxDashboardComponent),
      },
      {
        path: 'tax/calculator',
        canActivate: [planGuard('PRO')],
        loadComponent: () => import('./features/tax/tax-calculator/tax-calculator.component').then((m) => m.TaxCalculatorComponent),
      },
      {
        path: 'tax/capital-gains',
        canActivate: [planGuard('PRO')],
        loadComponent: () =>
          import('./features/tax/capital-gains/capital-gains-calculator.component').then((m) => m.CapitalGainsCalculatorComponent),
      },
      {
        path: 'tax/advance-tax',
        canActivate: [planGuard('PRO')],
        loadComponent: () =>
          import('./features/tax/advance-tax/advance-tax-calculator.component').then((m) => m.AdvanceTaxCalculatorComponent),
      },
      {
        path: 'tax/planner',
        canActivate: [planGuard('PRO')],
        loadComponent: () =>
          import('./features/tax/tax-planner/tax-saving-planner.component').then((m) => m.TaxSavingPlannerComponent),
      },
      {
        path: 'tax/reports',
        canActivate: [planGuard('PRO')],
        loadComponent: () => import('./features/tax/tax-reports/tax-reports.component').then((m) => m.TaxReportsComponent),
      },
      {
        path: 'tax/workspace',
        canActivate: [planGuard('PRO')],
        loadComponent: () =>
          import('./features/tax/tax-filing-workspace/tax-filing-workspace.component').then((m) => m.TaxFilingWorkspaceComponent),
      },
      {
        path: 'tax/history',
        canActivate: [planGuard('PRO')],
        loadComponent: () => import('./features/tax/tax-history/tax-history.component').then((m) => m.TaxHistoryComponent),
      },
      {
        path: 'tax/documents',
        canActivate: [planGuard('PRO')],
        loadComponent: () =>
          import('./features/tax/tax-documents/tax-documents.component').then((m) => m.TaxDocumentsComponent),
      },
      {
        path: 'tax/imports',
        canActivate: [planGuard('PRO')],
        loadComponent: () =>
          import('./features/tax/tax-imports/tax-imports.component').then((m) => m.TaxImportsComponent),
      },
      {
        path: 'tax/admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/tax/tax-admin/tax-admin.component').then((m) => m.TaxAdminComponent),
      },
      {
        path: 'health',
        loadComponent: () => import('./features/health/health-dashboard/health-dashboard.component').then((m) => m.HealthDashboardComponent),
      },
      {
        path: 'health/body-metrics',
        loadComponent: () => import('./features/health/body-metric-list/body-metric-list.component').then((m) => m.BodyMetricListComponent),
      },
      {
        path: 'health/vitals',
        loadComponent: () => import('./features/health/vital-list/vital-list.component').then((m) => m.VitalListComponent),
      },
      {
        path: 'health/workouts',
        loadComponent: () => import('./features/health/workout-list/workout-list.component').then((m) => m.WorkoutListComponent),
      },
      {
        path: 'health/medications',
        loadComponent: () => import('./features/health/medication-list/medication-list.component').then((m) => m.MedicationListComponent),
      },
      {
        path: 'health/appointments',
        loadComponent: () => import('./features/health/appointment-list/appointment-list.component').then((m) => m.AppointmentListComponent),
      },
      {
        path: 'health/goals',
        loadComponent: () => import('./features/health/health-goal-list/health-goal-list.component').then((m) => m.HealthGoalListComponent),
      },
      {
        path: 'health/reports/compare',
        loadComponent: () =>
          import('./features/health/health-report-compare/health-report-compare.component').then((m) => m.HealthReportCompareComponent),
      },
      {
        path: 'health/wellness-plan/:id',
        loadComponent: () =>
          import('./features/health/health-wellness-plan/health-wellness-plan-view.component').then((m) => m.HealthWellnessPlanViewComponent),
      },
      {
        path: 'health/reports/:id',
        loadComponent: () =>
          import('./features/health/health-report-detail/health-report-detail.component').then((m) => m.HealthReportDetailComponent),
      },
      {
        path: 'health/reports',
        loadComponent: () =>
          import('./features/health/health-report-list/health-report-list.component').then((m) => m.HealthReportListComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
