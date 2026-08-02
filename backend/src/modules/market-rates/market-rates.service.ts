import { prisma } from "../../config/prisma";
import { logger } from "../../config/logger";

const TROY_OUNCE_GRAMS = 31.1034768;
const STALE_MS = 24 * 60 * 60 * 1000; // refresh at most once a day per rate

const DISPLAY_ORDER = ["NIFTY50", "SENSEX", "BANKNIFTY", "GOLD", "SILVER"];

interface YahooQuote {
  price: number;
  previousClose: number;
}

async function fetchYahooQuote(symbol: string): Promise<YahooQuote> {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`Yahoo Finance request failed for ${symbol}: ${res.status}`);
  const data = (await res.json()) as {
    chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number } }[] };
  };
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") {
    throw new Error(`Unexpected Yahoo Finance response for ${symbol}`);
  }
  const previousClose = typeof meta.chartPreviousClose === "number" ? meta.chartPreviousClose : (meta.previousClose ?? meta.regularMarketPrice);
  return { price: meta.regularMarketPrice, previousClose };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

interface RateResult {
  symbol: string;
  label: string;
  unit: string;
  price: number;
  changeAmount: number;
  changePercent: number;
}

function toRateResult(symbol: string, label: string, unit: string, price: number, previousClose: number): RateResult {
  const changeAmount = price - previousClose;
  const changePercent = previousClose ? (changeAmount / previousClose) * 100 : 0;
  return { symbol, label, unit, price: round(price, 2), changeAmount: round(changeAmount, 2), changePercent: round(changePercent, 4) };
}

const INDEX_DEFINITIONS = [
  { symbol: "NIFTY50", label: "Nifty 50", unit: "index", yahooSymbol: "^NSEI" },
  { symbol: "SENSEX", label: "Sensex", unit: "index", yahooSymbol: "^BSESN" },
  { symbol: "BANKNIFTY", label: "Bank Nifty", unit: "index", yahooSymbol: "^NSEBANK" },
];

export const marketRatesService = {
  /** Fetches live index/commodity quotes and upserts them into the MarketRate table. */
  async refreshMarketRates(): Promise<void> {
    const results: RateResult[] = [];

    for (const def of INDEX_DEFINITIONS) {
      try {
        const quote = await fetchYahooQuote(def.yahooSymbol);
        results.push(toRateResult(def.symbol, def.label, def.unit, quote.price, quote.previousClose));
      } catch (err) {
        logger.error({ err, symbol: def.symbol }, "Failed to refresh market rate");
      }
    }

    try {
      const [gold, silver, usdInr] = await Promise.all([fetchYahooQuote("GC=F"), fetchYahooQuote("SI=F"), fetchYahooQuote("INR=X")]);

      // Gold/silver futures are quoted in USD per troy ounce; convert to INR per Indian retail unit.
      const toInrPerGrams = (usdPerOunce: number, grams: number) => (usdPerOunce / TROY_OUNCE_GRAMS) * grams * usdInr.price;

      results.push(toRateResult("GOLD", "Gold (10g, 24K)", "10g", toInrPerGrams(gold.price, 10), toInrPerGrams(gold.previousClose, 10)));
      results.push(toRateResult("SILVER", "Silver (1kg)", "kg", toInrPerGrams(silver.price, 1000), toInrPerGrams(silver.previousClose, 1000)));
    } catch (err) {
      logger.error({ err }, "Failed to refresh gold/silver market rates");
    }

    const now = new Date();
    for (const r of results) {
      await prisma.marketRate.upsert({
        where: { symbol: r.symbol },
        create: { symbol: r.symbol, label: r.label, unit: r.unit, price: r.price, changeAmount: r.changeAmount, changePercent: r.changePercent, asOf: now },
        update: { label: r.label, unit: r.unit, price: r.price, changeAmount: r.changeAmount, changePercent: r.changePercent, asOf: now },
      });
    }

    logger.info({ count: results.length }, "Market rates refreshed");
  },

  /** Returns cached market rates, refreshing first if the cache is empty or more than a day old. */
  async getLatestRates() {
    let rates = await prisma.marketRate.findMany();
    const isStale = rates.length < DISPLAY_ORDER.length || rates.some((r) => Date.now() - r.asOf.getTime() > STALE_MS);

    if (isStale) {
      await this.refreshMarketRates();
      rates = await prisma.marketRate.findMany();
    }

    const bySymbol = new Map(rates.map((r) => [r.symbol, r]));
    return DISPLAY_ORDER.map((symbol) => bySymbol.get(symbol))
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => ({
        symbol: r.symbol,
        label: r.label,
        unit: r.unit,
        price: Number(r.price),
        changeAmount: Number(r.changeAmount),
        changePercent: Number(r.changePercent),
        asOf: r.asOf,
      }));
  },
};
