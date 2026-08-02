import { logger } from "../config/logger";
import { refreshLiveCagrRates } from "../modules/investment-comparison/live-return.service";

/** Refreshes cached live trailing-CAGR rates used by the Investment Comparison tool. */
export async function runInvestmentComparisonLiveRefresh() {
  await refreshLiveCagrRates();
  logger.info("Investment comparison live CAGR refresh job completed");
}
