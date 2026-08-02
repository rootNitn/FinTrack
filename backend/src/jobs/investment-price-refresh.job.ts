import { logger } from "../config/logger";
import { investmentPriceRefreshService } from "../modules/investments/investment-price-refresh.service";

/** Refreshes live currentNav/currentValue for every user's Stock/Mutual Fund holdings that have units recorded. */
export async function runInvestmentPriceRefresh() {
  await investmentPriceRefreshService.refreshPricesForAllUsers();
  logger.info("Investment price refresh job completed");
}
