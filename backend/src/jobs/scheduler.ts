import cron from "node-cron";
import { logger } from "../config/logger";
import { runFdMaturityCheck } from "./fd-maturity.job";
import { runSipReminderCheck } from "./sip-reminder.job";
import { runMonthlySummaryJob } from "./monthly-summary.job";
import { runRecurringExpenseGeneration } from "./recurring-expense.job";
import { runFdPortfolioNotifications } from "./fd-portfolio-notifications.job";
import { runCreditCardDueReminderCheck } from "./credit-card-due-reminder.job";
import { runRecurringExpenseReminderCheck } from "./recurring-expense-reminder.job";
import { runBudgetExceededCheck } from "./budget-exceeded.job";
import { runBirthdayReminderCheck } from "./birthday-reminder.job";
import { runMarketRatesRefresh } from "./market-rates-refresh.job";
import { runInvestmentComparisonLiveRefresh } from "./investment-comparison-live-refresh.job";
import { runInvestmentPriceRefresh } from "./investment-price-refresh.job";

/** Registers all recurring background jobs. Called once on server startup. */
export function startScheduledJobs() {
  // Daily at 07:00 — FD maturity, SIP due, EMI/insurance due, budget exceeded, birthday reminders.
  cron.schedule("0 7 * * *", () => {
    runFdMaturityCheck().catch((err) => logger.error({ err }, "FD maturity job failed"));
    runSipReminderCheck().catch((err) => logger.error({ err }, "SIP reminder job failed"));
    runFdPortfolioNotifications().catch((err) => logger.error({ err }, "FD portfolio notification job failed"));
    runCreditCardDueReminderCheck().catch((err) => logger.error({ err }, "Credit card due reminder job failed"));
    runRecurringExpenseReminderCheck().catch((err) => logger.error({ err }, "Recurring expense reminder job failed"));
    runBudgetExceededCheck().catch((err) => logger.error({ err }, "Budget exceeded job failed"));
    runBirthdayReminderCheck().catch((err) => logger.error({ err }, "Birthday reminder job failed"));
  });

  // Daily at 06:30 — generate the next occurrence of due recurring expenses.
  cron.schedule("30 6 * * *", () => {
    runRecurringExpenseGeneration().catch((err) => logger.error({ err }, "Recurring expense job failed"));
  });

  // 1st of every month at 06:00 — monthly snapshot + summary notification.
  cron.schedule("0 6 1 * *", () => {
    runMonthlySummaryJob().catch((err) => logger.error({ err }, "Monthly summary job failed"));
  });

  // Daily at 18:00 (after Indian markets close) — refresh Nifty/Sensex/Bank Nifty/Gold/Silver rates.
  cron.schedule("0 18 * * *", () => {
    runMarketRatesRefresh().catch((err) => logger.error({ err }, "Market rates refresh job failed"));
  });

  // Daily at 18:15 — refresh live trailing-CAGR rates used by the Investment Comparison tool.
  cron.schedule("15 18 * * *", () => {
    runInvestmentComparisonLiveRefresh().catch((err) => logger.error({ err }, "Investment comparison live refresh job failed"));
  });

  // Daily at 18:30 — refresh currentNav/currentValue for imported Stock/Mutual Fund holdings.
  cron.schedule("30 18 * * *", () => {
    runInvestmentPriceRefresh().catch((err) => logger.error({ err }, "Investment price refresh job failed"));
  });

  logger.info("⏰ Scheduled background jobs registered");
}
