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

const schemeCategoryCache = new Map<number, { fetchedAt: number; category: string | null }>();

/**
 * Fetches the AMFI scheme category (e.g. "Equity Scheme - Large Cap Fund") for a scheme code —
 * used to auto-classify mutual fund holdings for the Mutual Funds dashboard's benchmark rating.
 * Cached for 6 hours since it changes essentially never.
 */
async function fetchMfSchemeCategory(schemeCode: number): Promise<string | null> {
  const cached = schemeCategoryCache.get(schemeCode);
  if (cached && Date.now() - cached.fetchedAt < MF_CACHE_MS) return cached.category;

  const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
  if (!res.ok) throw new Error(`Mutual fund scheme detail fetch failed for scheme ${schemeCode}: ${res.status}`);
  const data = (await res.json()) as { meta?: { scheme_category?: string } };
  const category = data.meta?.scheme_category ?? null;

  schemeCategoryCache.set(schemeCode, { fetchedAt: Date.now(), category });
  return category;
}

function normalizeSchemeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Best-effort scheme-name matcher: exact normalized match first, else the candidate that (a) shares
 * the same fund house as the investment name's first word (e.g. "hdfc", "navi", "bandhan") AND
 * (b) contains every single word from the investment name (recall === 1) — tied-broken by whichever
 * candidate has the fewest extra words (highest precision), which naturally favors "Direct Plan"
 * variants over "Regular" ones when the investment name says "Direct".
 *
 * Both conditions are required and non-negotiable: a previous version accepted recall >= 0.8, which
 * let scheme names missing only the fund house word (e.g. "HDFC Mid Cap Fund Direct Growth" missing
 * just "hdfc") slip through — generic words like "fund"/"direct"/"growth"/"plan" are common enough
 * across totally unrelated schemes that an 80% overlap is not a reliable signal on its own. Investment
 * names imported from brokers are effectively verbatim (or truncated) copies of the official AMFI
 * scheme name, so a genuine match should never be missing a word — if no candidate satisfies both
 * conditions, it's safer to skip the refresh than to silently attach the wrong scheme's NAV.
 */
function findMatchingScheme(schemes: MfScheme[], investmentName: string): MfScheme | null {
  const target = normalizeSchemeName(investmentName);
  const exact = schemes.find((s) => normalizeSchemeName(s.schemeName) === target);
  if (exact) return exact;

  const targetTokens = target.split(" ").filter(Boolean);
  if (targetTokens.length === 0) return null;
  const targetTokenSet = new Set(targetTokens);
  const fundHouseToken = targetTokens[0];

  let best: { scheme: MfScheme; precision: number } | null = null;
  for (const s of schemes) {
    const tokens = normalizeSchemeName(s.schemeName).split(" ").filter(Boolean);
    if (tokens.length === 0 || tokens[0] !== fundHouseToken) continue;

    const overlap = tokens.filter((t) => targetTokenSet.has(t)).length;
    const recall = overlap / targetTokens.length;
    if (recall < 1) continue;

    const precision = overlap / tokens.length;
    if (!best || precision > best.precision) {
      best = { scheme: s, precision };
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
          let schemeCode = inv.mfSchemeCode;
          let schemeCategory = inv.mfSchemeCategory;

          if (!schemeCode) {
            mfSchemes = mfSchemes ?? (await loadMfSchemeList());
            const match = findMatchingScheme(mfSchemes, inv.name);
            if (!match) {
              skipped += 1;
              continue;
            }
            schemeCode = match.schemeCode;
            // Best-effort — a category lookup failure shouldn't block the NAV refresh itself.
            schemeCategory = await fetchMfSchemeCategory(schemeCode).catch(() => null);
          }

          nav = await fetchMfNav(schemeCode);

          await prisma.investment.update({
            where: { id: inv.id },
            data: { mfSchemeCode: schemeCode, mfSchemeCategory: schemeCategory },
          });
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
