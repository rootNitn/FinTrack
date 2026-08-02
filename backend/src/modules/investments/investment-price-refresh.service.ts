import { InvestmentCategory, InvestmentStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { logger } from "../../config/logger";

interface YahooQuote {
  price: number;
}

async function fetchYahooQuote(symbol: string): Promise<YahooQuote> {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`Yahoo Finance request failed for ${symbol}: ${res.status}`);
  const data = (await res.json()) as { chart?: { result?: { meta?: { regularMarketPrice?: number } }[] } };
  const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (typeof price !== "number") throw new Error(`Unexpected Yahoo Finance response for ${symbol}`);
  return { price };
}

/** Looks up a live price for an Indian equity by ticker — tries NSE (.NS) first, then BSE (.BO). */
async function fetchIndianStockPrice(symbol: string): Promise<number> {
  try {
    return (await fetchYahooQuote(`${symbol}.NS`)).price;
  } catch {
    return (await fetchYahooQuote(`${symbol}.BO`)).price;
  }
}

interface MfScheme {
  schemeCode: number;
  schemeName: string;
}

let schemeListCache: { fetchedAt: number; schemes: MfScheme[] } | null = null;
const MF_CACHE_MS = 6 * 60 * 60 * 1000; // mutual fund NAVs are published once a day — 6h cache is generous but avoids hammering the API.
const navByCodeCache = new Map<number, { fetchedAt: number; nav: number }>();

/**
 * Downloads the full list of mutual fund schemes (code + name) from mfapi.in — a free, widely used
 * mirror of AMFI's official data. (AMFI's own NAVAll.txt download was retired when their site was
 * rebuilt, so this is the more reliable public source as of 2026.)
 */
async function loadMfSchemeList(): Promise<MfScheme[]> {
  if (schemeListCache && Date.now() - schemeListCache.fetchedAt < MF_CACHE_MS) return schemeListCache.schemes;

  const res = await fetch("https://api.mfapi.in/mf");
  if (!res.ok) throw new Error(`Mutual fund scheme list fetch failed: ${res.status}`);
  const schemes = (await res.json()) as MfScheme[];

  schemeListCache = { fetchedAt: Date.now(), schemes };
  return schemes;
}

/** Fetches the latest published NAV for a given mfapi.in scheme code, cached for 6 hours. */
async function fetchMfNav(schemeCode: number): Promise<number> {
  const cached = navByCodeCache.get(schemeCode);
  if (cached && Date.now() - cached.fetchedAt < MF_CACHE_MS) return cached.nav;

  const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`);
  if (!res.ok) throw new Error(`Mutual fund NAV fetch failed for scheme ${schemeCode}: ${res.status}`);
  const data = (await res.json()) as { data?: { nav?: string }[] };
  const nav = Number(data.data?.[0]?.nav);
  if (!Number.isFinite(nav) || nav <= 0) throw new Error(`Unexpected NAV response for scheme ${schemeCode}`);

  navByCodeCache.set(schemeCode, { fetchedAt: Date.now(), nav });
  return nav;
}

function normalizeSchemeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Best-effort scheme-name matcher: exact normalized match first, else the candidate that covers the
 * most target words (recall) — tie-broken by the closest overall length (precision). Recall is
 * prioritized over the previous overlap/max-length scoring because it correctly favors "Direct
 * Plan" variants over "Regular" ones when the investment name says "Direct" (a longer, more precise
 * scheme name shouldn't be penalized just for having more descriptive words).
 */
function findMatchingScheme(schemes: MfScheme[], investmentName: string): MfScheme | null {
  const target = normalizeSchemeName(investmentName);
  const exact = schemes.find((s) => normalizeSchemeName(s.schemeName) === target);
  if (exact) return exact;

  const targetTokens = target.split(" ").filter(Boolean);
  if (targetTokens.length === 0) return null;
  const targetTokenSet = new Set(targetTokens);

  let best: { scheme: MfScheme; recall: number; precision: number } | null = null;
  for (const s of schemes) {
    const tokens = normalizeSchemeName(s.schemeName).split(" ").filter(Boolean);
    if (tokens.length === 0) continue;
    const overlap = tokens.filter((t) => targetTokenSet.has(t)).length;
    const recall = overlap / targetTokens.length;
    const precision = overlap / tokens.length;
    if (recall < 0.8) continue;
    if (!best || recall > best.recall || (recall === best.recall && precision > best.precision)) {
      best = { scheme: s, recall, precision };
    }
  }
  return best?.scheme ?? null;
}


export interface PriceRefreshResult {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
}

export const investmentPriceRefreshService = {
  /**
   * Refreshes currentNav/currentValue for a user's Stock/Mutual Fund holdings using live market data.
   * Only investments with `units` recorded can be refreshed (currentValue = live price × units) —
   * this is populated automatically for broker-imported rows, but manually-added rows without units
   * (or Stocks without a `symbol`) are skipped rather than guessed at.
   */
  async refreshPricesForUser(userId: string): Promise<PriceRefreshResult> {
    const investments = await prisma.investment.findMany({
      where: {
        userId,
        status: InvestmentStatus.ACTIVE,
        category: { in: [InvestmentCategory.STOCKS, InvestmentCategory.MUTUAL_FUNDS] },
        units: { not: null },
      },
    });

    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let mfSchemes: MfScheme[] | null = null;

    for (const inv of investments) {
      const units = inv.units ? Number(inv.units) : 0;
      if (!units || units <= 0) {
        skipped += 1;
        continue;
      }

      try {
        let nav: number | null = null;

        if (inv.category === InvestmentCategory.STOCKS) {
          if (!inv.symbol) {
            skipped += 1;
            continue;
          }
          nav = await fetchIndianStockPrice(inv.symbol);
        } else {
          mfSchemes = mfSchemes ?? (await loadMfSchemeList());
          const match = findMatchingScheme(mfSchemes, inv.name);
          if (!match) {
            skipped += 1;
            continue;
          }
          nav = await fetchMfNav(match.schemeCode);
        }

        await prisma.investment.update({
          where: { id: inv.id },
          data: {
            currentNav: nav,
            currentValue: Number((nav * units).toFixed(2)),
            lastPriceRefreshAt: new Date(),
          },
        });
        updated += 1;
      } catch (err) {
        logger.error({ err, investmentId: inv.id }, "Failed to refresh investment price");
        failed += 1;
      }
    }

    return { total: investments.length, updated, skipped, failed };
  },

  /** Runs price refresh for every user who holds at least one refreshable investment. Used by the daily cron job. */
  async refreshPricesForAllUsers(): Promise<void> {
    const owners = await prisma.investment.findMany({
      where: {
        status: InvestmentStatus.ACTIVE,
        category: { in: [InvestmentCategory.STOCKS, InvestmentCategory.MUTUAL_FUNDS] },
        units: { not: null },
      },
      distinct: ["userId"],
      select: { userId: true },
    });

    let totalUpdated = 0;
    for (const { userId } of owners) {
      const result = await this.refreshPricesForUser(userId);
      totalUpdated += result.updated;
    }
    logger.info({ users: owners.length, updated: totalUpdated }, "Investment price refresh completed for all users");
  },
};
