import { Router } from "express";
import { authRoutes } from "./auth/auth.routes";
import { billingRoutes } from "./billing/billing.routes";
import { investmentRoutes } from "./investments/investments.routes";
import { transactionRoutes } from "./transactions/transactions.routes";
import { expenseRoutes } from "./expenses/expenses.routes";
import { incomeRoutes } from "./income/income.routes";
import { bankRoutes } from "./banks/banks.routes";
import { goalRoutes } from "./goals/goals.routes";
import { budgetRoutes } from "./budgets/budgets.routes";
import { familyMemberRoutes } from "./family-members/family-members.routes";
import { dashboardRoutes } from "./dashboard/dashboard.routes";
import { reportRoutes } from "./reports/reports.routes";
import { notificationRoutes } from "./notifications/notifications.routes";
import { settingsRoutes } from "./settings/settings.routes";
import { adminRoutes } from "./admin/admin.routes";
import { fdBanksRoutes } from "./fd/fd-banks.routes";
import { fdRatesRoutes } from "./fd/fd-rates.routes";
import { fdRateHistoryRoutes } from "./fd/fd-rate-history.routes";
import { fdPortfolioRoutes } from "./fd/fd-portfolio.routes";
import { fdFavoritesRoutes } from "./fd/fd-favorites.routes";
import { fdCalculateRoutes } from "./fd/fd-calculate.routes";
import { investmentComparisonRoutes } from "./investment-comparison/investment-comparison.routes";
import { aiInsightsRoutes } from "./ai-insights/ai-insights.routes";
import { aiChatRoutes } from "./ai-chat/ai-chat.routes";
import { aiReportRoutes } from "./ai-report/ai-report.routes";
import { creditCardRoutes } from "./credit-cards/credit-cards.routes";
import { analyticsRoutes } from "./analytics/analytics.routes";
import { businessRoutes } from "./business/business.routes";
import { upcomingBillsRoutes } from "./upcoming-bills/upcoming-bills.routes";
import { marketRatesRoutes } from "./market-rates/market-rates.routes";
import { investmentImportRoutes } from "./investment-import/investment-import.routes";
import { bankImportRoutes } from "./bank-import/bank-import.routes";
import { taxRoutes } from "./tax/tax.routes";
import { taxAdminRoutes } from "./tax/tax-admin.routes";
import { documentsRoutes } from "./documents/documents.routes";
import { salarySlipRoutes } from "./salary-slip/salary-slip.routes";
import { form16Routes } from "./form16/form16.routes";
import { aisRoutes } from "./ais/ais.routes";
import { form26ASRoutes } from "./form26as/form26as.routes";
import { reconciliationRoutes } from "./reconciliation/reconciliation.routes";
import { capitalGainsRoutes } from "./capital-gains/capital-gains.routes";
import { hraRoutes } from "./hra/hra.routes";
import { gratuityRoutes } from "./gratuity/gratuity.routes";
import { leaveEncashmentRoutes } from "./leave-encashment/leave-encashment.routes";
import { advanceTaxRoutes } from "./advance-tax/advance-tax.routes";
import { taxPlannerRoutes } from "./tax-planner/tax-planner.routes";
import { mutualFundsRoutes } from "./mutual-funds/mutual-funds.routes";
import { financialHealthRoutes } from "./financial-health/financial-health.routes";
import { financialLevelRoutes } from "./financial-level/financial-level.routes";
import { liabilitiesRoutes } from "./liabilities/liabilities.routes";
import { insuranceRoutes } from "./insurance/insurance.routes";
import { incomeSourcesRoutes } from "./income-sources/income-sources.routes";
import { supportTicketRoutes } from "./support-tickets/support-tickets.routes";
import { supportTicketAdminRoutes } from "./support-tickets/support-tickets.admin.routes";
import { bodyMetricsRoutes } from "./health/body-metrics.routes";
import { vitalsRoutes } from "./health/vitals.routes";
import { workoutsRoutes } from "./health/workouts.routes";
import { dailyLogRoutes } from "./health/daily-log.routes";
import { medicationsRoutes } from "./health/medications.routes";
import { appointmentsRoutes } from "./health/appointments.routes";
import { healthGoalsRoutes } from "./health/health-goals.routes";
import { healthSummaryRoutes } from "./health/health-summary.routes";
import { healthConnectRoutes } from "./health/health-connect.routes";
import { healthReportsRoutes } from "./health/health-reports.routes";
import { healthAiImproveRoutes } from "./health/health-ai-improve.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/billing", billingRoutes);
apiRouter.use("/investments", investmentRoutes);
apiRouter.use("/transactions", transactionRoutes);
apiRouter.use("/expenses", expenseRoutes);
apiRouter.use("/income", incomeRoutes);
apiRouter.use("/banks", bankRoutes);
apiRouter.use("/goals", goalRoutes);
apiRouter.use("/budgets", budgetRoutes);
apiRouter.use("/family-members", familyMemberRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
apiRouter.use("/reports", reportRoutes);
apiRouter.use("/notifications", notificationRoutes);
apiRouter.use("/settings", settingsRoutes);
apiRouter.use("/admin", adminRoutes);

// Fixed Deposit module — prefixed under /fd/* to avoid colliding with the existing
// /banks route (which serves the user's own BankAccount records, not FD-provider banks).
apiRouter.use("/fd/banks", fdBanksRoutes);
apiRouter.use("/fd/rates", fdRatesRoutes);
apiRouter.use("/fd/rate-history", fdRateHistoryRoutes);
apiRouter.use("/fd/portfolio", fdPortfolioRoutes);
apiRouter.use("/fd/favorites", fdFavoritesRoutes);
apiRouter.use("/fd", fdCalculateRoutes);

apiRouter.use("/investment-imports", investmentImportRoutes);
apiRouter.use("/bank-import", bankImportRoutes);
apiRouter.use("/investment-comparison", investmentComparisonRoutes);
apiRouter.use("/ai-insights", aiInsightsRoutes);
apiRouter.use("/ai-chat", aiChatRoutes);
apiRouter.use("/ai-report", aiReportRoutes);
apiRouter.use("/credit-cards", creditCardRoutes);
apiRouter.use("/analytics", analyticsRoutes);
apiRouter.use("/businesses", businessRoutes);
apiRouter.use("/upcoming-bills", upcomingBillsRoutes);
apiRouter.use("/market-rates", marketRatesRoutes);
apiRouter.use("/mutual-funds", mutualFundsRoutes);
apiRouter.use("/financial-health", financialHealthRoutes);
apiRouter.use("/financial-level", financialLevelRoutes);
apiRouter.use("/income-sources", incomeSourcesRoutes);
apiRouter.use("/liabilities", liabilitiesRoutes);
apiRouter.use("/insurance", insuranceRoutes);
apiRouter.use("/support-tickets/admin", supportTicketAdminRoutes);
apiRouter.use("/support-tickets", supportTicketRoutes);

// Income Tax Calculator module — admin (slab/rebate/surcharge/cess/deduction rule management)
// mounted before the more general /tax user-facing routes.
apiRouter.use("/tax/admin", taxAdminRoutes);
apiRouter.use("/tax", taxRoutes);

// Advanced Tax Intelligence module — encrypted document storage (Salary Slip/Form16/AIS/Form26AS).
apiRouter.use("/documents", documentsRoutes);
apiRouter.use("/salary-slip", salarySlipRoutes);
apiRouter.use("/form16", form16Routes);
apiRouter.use("/ais", aisRoutes);
apiRouter.use("/form26as", form26ASRoutes);
apiRouter.use("/reconciliation", reconciliationRoutes);

// Phase 3 — Standalone Calculators (Capital Gains, HRA, Gratuity, Leave Encashment, Advance Tax,
// Tax Saving Planner) — reuse the same DB-driven tax-rules foundation as the main /tax module.
apiRouter.use("/capital-gains", capitalGainsRoutes);
apiRouter.use("/hra", hraRoutes);
apiRouter.use("/gratuity", gratuityRoutes);
apiRouter.use("/leave-encashment", leaveEncashmentRoutes);
apiRouter.use("/advance-tax", advanceTaxRoutes);
apiRouter.use("/tax-planner", taxPlannerRoutes);

// Health Tracker module — body metrics/vitals/workouts/daily wellness log, medications (+ dose
// logs), doctor appointments, health goals, plus a dashboard summary endpoint.
apiRouter.use("/health/body-metrics", bodyMetricsRoutes);
apiRouter.use("/health/vitals", vitalsRoutes);
apiRouter.use("/health/workouts", workoutsRoutes);
apiRouter.use("/health/daily-log", dailyLogRoutes);
apiRouter.use("/health/medications", medicationsRoutes);
apiRouter.use("/health/appointments", appointmentsRoutes);
apiRouter.use("/health/goals", healthGoalsRoutes);
apiRouter.use("/health/summary", healthSummaryRoutes);
apiRouter.use("/health/reports", healthReportsRoutes);
apiRouter.use("/health/ai-improve", healthAiImproveRoutes);
apiRouter.use("/health", healthConnectRoutes);
