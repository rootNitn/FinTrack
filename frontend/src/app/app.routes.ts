import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
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
        path: 'expenses',
        loadComponent: () =>
          import('./features/expenses/expense-list/expense-list.component').then((m) => m.ExpenseListComponent),
      },
      {
        path: 'income',
        loadComponent: () => import('./features/income/income-list/income-list.component').then((m) => m.IncomeListComponent),
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
        path: 'reports',
        loadComponent: () => import('./features/reports/report-view/report-view.component').then((m) => m.ReportViewComponent),
      },
      {
        path: 'calculators',
        loadComponent: () =>
          import('./features/calculators/calculator-list/calculator-list.component').then((m) => m.CalculatorListComponent),
      },
      {
        path: 'calculators/hra',
        loadComponent: () =>
          import('./features/calculators/hra-calculator/hra-calculator.component').then((m) => m.HraCalculatorComponent),
      },
      {
        path: 'calculators/gratuity',
        loadComponent: () =>
          import('./features/calculators/gratuity-calculator/gratuity-calculator.component').then((m) => m.GratuityCalculatorComponent),
      },
      {
        path: 'calculators/leave-encashment',
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
        loadComponent: () =>
          import('./features/investment-comparison/investment-comparison.component').then((m) => m.InvestmentComparisonComponent),
      },
      {
        path: 'mutual-funds',
        loadComponent: () =>
          import('./features/mutual-funds/mutual-funds.component').then((m) => m.MutualFundsComponent),
      },
      {
        path: 'ai-insights',
        loadComponent: () => import('./features/ai-insights/ai-insights.component').then((m) => m.AiInsightsComponent),
      },
      {
        path: 'analytics',
        loadComponent: () => import('./features/analytics/analytics.component').then((m) => m.AnalyticsComponent),
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
        loadComponent: () => import('./features/tax/tax-dashboard/tax-dashboard.component').then((m) => m.TaxDashboardComponent),
      },
      {
        path: 'tax/calculator',
        loadComponent: () => import('./features/tax/tax-calculator/tax-calculator.component').then((m) => m.TaxCalculatorComponent),
      },
      {
        path: 'tax/capital-gains',
        loadComponent: () =>
          import('./features/tax/capital-gains/capital-gains-calculator.component').then((m) => m.CapitalGainsCalculatorComponent),
      },
      {
        path: 'tax/advance-tax',
        loadComponent: () =>
          import('./features/tax/advance-tax/advance-tax-calculator.component').then((m) => m.AdvanceTaxCalculatorComponent),
      },
      {
        path: 'tax/planner',
        loadComponent: () =>
          import('./features/tax/tax-planner/tax-saving-planner.component').then((m) => m.TaxSavingPlannerComponent),
      },
      {
        path: 'tax/reports',
        loadComponent: () => import('./features/tax/tax-reports/tax-reports.component').then((m) => m.TaxReportsComponent),
      },
      {
        path: 'tax/workspace',
        loadComponent: () =>
          import('./features/tax/tax-filing-workspace/tax-filing-workspace.component').then((m) => m.TaxFilingWorkspaceComponent),
      },
      {
        path: 'tax/history',
        loadComponent: () => import('./features/tax/tax-history/tax-history.component').then((m) => m.TaxHistoryComponent),
      },
      {
        path: 'tax/documents',
        loadComponent: () =>
          import('./features/tax/tax-documents/tax-documents.component').then((m) => m.TaxDocumentsComponent),
      },
      {
        path: 'tax/imports',
        loadComponent: () =>
          import('./features/tax/tax-imports/tax-imports.component').then((m) => m.TaxImportsComponent),
      },
      {
        path: 'tax/admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/tax/tax-admin/tax-admin.component').then((m) => m.TaxAdminComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
