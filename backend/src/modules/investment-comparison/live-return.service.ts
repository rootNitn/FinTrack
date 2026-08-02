import { prisma } from "../../config/prisma";
import { logger } from "../../config/logger";
import { InvestmentInstrumentType } from "./investment-comparison.constants";

const STALE_MS = 24 * 60 * 60 * 1000; // refresh at most once a day per instrument

type LiveSource =
  | { kind: "YAHOO_INDEX"; yahooSymbol: string; maxYears: number }
  | { kind: "MFAPI_FUND"; schemeCode: number; maxYears: number };

/**
 * Maps instrument types to a free, no-API-key live data source used to compute a trailing
 * annualized return (CAGR) instead of the static `assumedAnnualReturnPercent` fallback:
 *  - Nifty 50/100: live index levels from Yahoo Finance (same source as the dashboard's Market Rates widget).
 *  - Equity/debt/liquid fund categories: NAV history for one representative benchmark scheme,
 *    sourced from mfapi.in (a free wrapper around AMFI's public NAV data).
 */
export const LIVE_CAGR_SOURCES: Partial<Record<InvestmentInstrumentType, LiveSource>> = {
  NIFTY_50_INDEX_FUND: { kind: "YAHOO_INDEX", yahooSymbol: "^NSEI", maxYears: 5 },
  NIFTY_100_INDEX_FUND: { kind: "YAHOO_INDEX", yahooSymbol: "^CNX100", maxYears: 5 },
  LARGE_CAP_FUND: { kind: "MFAPI_FUND", schemeCode: 120586, maxYears: 5 }, // ICICI Prudential Large Cap Fund - Direct Growth
  MID_CAP_FUND: { kind: "MFAPI_FUND", schemeCode: 151724, maxYears: 5 }, // HDFC NIFTY Midcap 150 Index Fund - Direct Growth
  SMALL_CAP_FUND: { kind: "MFAPI_FUND", schemeCode: 118778, maxYears: 5 }, // Nippon India Small Cap Fund - Direct Growth
  DEBT_MUTUAL_FUND: { kind: "MFAPI_FUND", schemeCode: 118987, maxYears: 3 }, // HDFC Corporate Bond Fund - Direct Growth
  LIQUID_FUND: { kind: "MFAPI_FUND", schemeCode: 119091, maxYears: 1 }, // HDFC Liquid Fund - Direct Growth
};

function symbolFor(type: InvestmentInstrumentType): string {
  return `CAGR_${type}`;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

interface CagrPoint {
  percent: number;
  years: number;
}

async function fetchYahooIndexCagr(yahooSymbol: string, maxYears: number): Promise<CagrPoint | null> {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${maxYears}y&interval=1mo`);
  if (!res.ok) throw new Error(`Yahoo Finance request failed for ${yahooSymbol}: ${res.status}`);
  const data = (await res.json()) as {
    chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
  };
  const result = data.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const points = timestamps
    .map((t, i) => ({ t, close: closes[i] }))
    .filter((p): p is { t: number; close: number } => typeof p.close === "number");
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const years = (last.t - first.t) / (365.25 * 24 * 60 * 60);
  if (years <= 0 || first.close <= 0) return null;

  return { percent: (Math.pow(last.close / first.close, 1 / years) - 1) * 100, years };
}

async function fetchMfapiFundCagr(schemeCode: number, maxYears: number): Promise<CagrPoint | null> {
  const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
  if (!res.ok) throw new Error(`mfapi.in request failed for scheme ${schemeCode}: ${res.status}`);
  const data = (await res.json()) as { data?: { date: string; nav: string }[] };
  const navs = data.data ?? [];
  if (navs.length < 2) return null;

  const parseDate = (d: string) => {
    const [dd, mm, yyyy] = d.split("-").map(Number);
    return new Date(yyyy, mm - 1, dd).getTime();
  };

  const latest = navs[0];
  const latestTime = parseDate(latest.date);
  const cutoff = latestTime - maxYears * 365.25 * 24 * 60 * 60 * 1000;

  // NAVs are sorted newest-first; find the first entry at or before the cutoff, falling back
  // to the oldest available NAV if the fund's history is shorter than `maxYears`.
  let reference = navs[navs.length - 1];
  for (const entry of navs) {
    if (parseDate(entry.date) <= cutoff) {
      reference = entry;
      break;
    }
  }

  const years = (latestTime - parseDate(reference.date)) / (365.25 * 24 * 60 * 60 * 1000);
  const latestNav = Number(latest.nav);
  const referenceNav = Number(reference.nav);
  if (years <= 0 || referenceNav <= 0) return null;

  return { percent: (Math.pow(latestNav / referenceNav, 1 / years) - 1) * 100, years };
}

function fetchLiveCagr(source: LiveSource): Promise<CagrPoint | null> {
  return source.kind === "YAHOO_INDEX" ? fetchYahooIndexCagr(source.yahooSymbol, source.maxYears) : fetchMfapiFundCagr(source.schemeCode, source.maxYears);
}

/** Fetches live trailing CAGR for every mapped instrument and caches it in the shared MarketRate table. */
export async function refreshLiveCagrRates(): Promise<void> {
  const now = new Date();
  for (const [type, source] of Object.entries(LIVE_CAGR_SOURCES) as [InvestmentInstrumentType, LiveSource][]) {
    try {
      const result = await fetchLiveCagr(source);
      if (!result) continue;
      const symbol = symbolFor(type);
      const unit = `${round2(result.years)}y`;
      const price = round2(result.percent);
      await prisma.marketRate.upsert({
        where: { symbol },
        create: { symbol, label: type, unit, price, changeAmount: 0, changePercent: 0, asOf: now },
        update: { unit, price, changeAmount: 0, changePercent: 0, asOf: now },
      });
    } catch (err) {
      logger.error({ err, type }, "Failed to refresh live CAGR rate");
    }
  }
}

export interface LiveCagrResult {
  percent: number;
  years: number;
  asOf: Date;
}

/** Returns cached live CAGR rates for all mapped instrument types, refreshing stale/missing ones first. */
export async function getLiveCagrRates(): Promise<Partial<Record<InvestmentInstrumentType, LiveCagrResult>>> {
  const types = Object.keys(LIVE_CAGR_SOURCES) as InvestmentInstrumentType[];
  const symbols = types.map(symbolFor);

  let rows = await prisma.marketRate.findMany({ where: { symbol: { in: symbols } } });
  const isStale = rows.length < symbols.length || rows.some((r) => Date.now() - r.asOf.getTime() > STALE_MS);

  if (isStale) {
    await refreshLiveCagrRates();
    rows = await prisma.marketRate.findMany({ where: { symbol: { in: symbols } } });
  }

  const bySymbol = new Map(rows.map((r) => [r.symbol, r]));
  const out: Partial<Record<InvestmentInstrumentType, LiveCagrResult>> = {};
  for (const type of types) {
    const row = bySymbol.get(symbolFor(type));
    if (!row) continue;
    out[type] = { percent: Number(row.price), years: parseFloat(row.unit), asOf: row.asOf };
  }
  return out;
}
