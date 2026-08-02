import { logger } from "../config/logger";
import { marketRatesService } from "../modules/market-rates/market-rates.service";

/** Refreshes cached Nifty/Sensex/Bank Nifty/Gold/Silver rates from the live market data source. */
export async function runMarketRatesRefresh() {
  await marketRatesService.refreshMarketRates();
  logger.info("Market rates refresh job completed");
}
