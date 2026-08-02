import { getFdRateProvider } from "../fd/providers/fd-rate.provider";
import { computeInstrumentReturn } from "./investment-comparison.util";
import { getInstrumentReference, INSTRUMENT_REFERENCE, InvestmentInstrumentType, RiskLevel } from "./investment-comparison.constants";
import { CompareInvestmentsQuery } from "./investment-comparison.dto";
import { getLiveCagrRates, LiveCagrResult } from "./live-return.service";

export interface InvestmentComparisonRow {
  type: InvestmentInstrumentType;
  label: string;
  category: string;
  description: string;
  returnType: string;
  assumedAnnualReturnPercent: number;
  returnRateNote: string;
  isLiveRate: boolean;
  maturityAmount: number;
  interestEarned: number;
  effectiveAnnualYieldPercent: number;
  lockInMonths: number;
  lockInNote: string;
  liquidity: string;
  liquidityNote: string;
  taxation: string;
  riskLevel: RiskLevel;
  minInvestment: number;
  isEligible: boolean;
  eligibilityNote?: string;
  calcNote?: string;
  isBestReturn?: boolean;
  isMostLiquid?: boolean;
  isSafest?: boolean;
}

export interface InvestmentComparisonResult {
  amount: number;
  tenureYears: number;
  rows: InvestmentComparisonRow[];
  bestReturnType: InvestmentInstrumentType | null;
  mostLiquidType: InvestmentInstrumentType | null;
  safestType: InvestmentInstrumentType | null;
  disclaimer: string;
}

const LIQUIDITY_RANK: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
const RISK_RANK: Record<RiskLevel, number> = { LOW: 0, LOW_MODERATE: 1, MODERATE: 2, MODERATE_HIGH: 3, HIGH: 4 };

async function bestLiveFdRate(tenureYears: number): Promise<number | null> {
  const tenureDays = Math.round(tenureYears * 365);
  const provider = getFdRateProvider();
  const banks = await provider.getAllBanks(true);

  let best: number | null = null;
  for (const bank of banks) {
    const match = bank.rates.find((r) => tenureDays >= r.tenureMinDays && tenureDays <= r.tenureMaxDays);
    if (match && (best === null || match.interestRate > best)) {
      best = match.interestRate;
    }
  }
  return best;
}

function riskLevelOf(type: InvestmentInstrumentType): RiskLevel {
  return getInstrumentReference(type).riskLevel;
}

export const investmentComparisonService = {
  async compare(query: CompareInvestmentsQuery): Promise<InvestmentComparisonResult> {
    const { amount, tenureYears, riskLevels, sortBy, sortDir } = query;

    const [liveFdRate, liveCagrRates] = await Promise.all([
      bestLiveFdRate(tenureYears).catch(() => null),
      getLiveCagrRates().catch(() => ({} as Partial<Record<InvestmentInstrumentType, LiveCagrResult>>)),
    ]);

    let rows: InvestmentComparisonRow[] = INSTRUMENT_REFERENCE.map((ref) => {
      let ratePercent = ref.assumedAnnualReturnPercent;
      let rateNote = ref.returnRateNote;
      let isLiveRate = false;

      if (ref.type === "FIXED_DEPOSIT" && liveFdRate !== null) {
        ratePercent = liveFdRate;
        rateNote = "Best available live FD rate for this tenure";
        isLiveRate = true;
      } else {
        const live = liveCagrRates[ref.type];
        if (live) {
          ratePercent = live.percent;
          rateNote = `Live trailing ${live.years.toFixed(1)}-year CAGR (auto-updated daily)`;
          isLiveRate = true;
        }
      }

      const isEligible = tenureYears >= ref.minTenureYears && (ref.maxTenureYears === null || tenureYears <= ref.maxTenureYears);
      const eligibilityNote = !isEligible
        ? tenureYears < ref.minTenureYears
          ? `Requires a minimum tenure of ${ref.minTenureYears} year(s).`
          : `Maximum tenure for this instrument is ${ref.maxTenureYears} year(s).`
        : undefined;

      const { maturityAmount, interestEarned, effectiveAnnualYieldPercent, calcNote } = computeInstrumentReturn(
        ref.type,
        amount,
        tenureYears,
        ratePercent
      );

      return {
        type: ref.type,
        label: ref.label,
        category: ref.category,
        description: ref.description,
        returnType: ref.returnType,
        assumedAnnualReturnPercent: ratePercent,
        returnRateNote: rateNote,
        isLiveRate,
        maturityAmount,
        interestEarned,
        effectiveAnnualYieldPercent,
        lockInMonths: ref.lockInMonths,
        lockInNote: ref.lockInNote,
        liquidity: ref.liquidity,
        liquidityNote: ref.liquidityNote,
        taxation: ref.taxation,
        riskLevel: ref.riskLevel,
        minInvestment: ref.minInvestment,
        isEligible,
        eligibilityNote,
        calcNote,
      };
    });

    if (riskLevels && riskLevels.length > 0) {
      rows = rows.filter((r) => riskLevels.includes(r.riskLevel));
    }

    const eligibleRows = rows.filter((r) => r.isEligible);

    const bestReturn = eligibleRows.reduce<InvestmentComparisonRow | null>(
      (best, r) => (best === null || r.maturityAmount > best.maturityAmount ? r : best),
      null
    );
    const mostLiquid = eligibleRows.reduce<InvestmentComparisonRow | null>(
      (best, r) => (best === null || LIQUIDITY_RANK[r.liquidity] > LIQUIDITY_RANK[best.liquidity] ? r : best),
      null
    );
    const safest = eligibleRows.reduce<InvestmentComparisonRow | null>(
      (best, r) => (best === null || RISK_RANK[r.riskLevel] < RISK_RANK[best.riskLevel] ? r : best),
      null
    );

    rows = rows.map((r) => ({
      ...r,
      isBestReturn: bestReturn?.type === r.type,
      isMostLiquid: mostLiquid?.type === r.type,
      isSafest: safest?.type === r.type,
    }));

    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      return (a[sortBy] - b[sortBy]) * dir;
    });

    return {
      amount,
      tenureYears,
      rows,
      bestReturnType: bestReturn?.type ?? null,
      mostLiquidType: mostLiquid?.type ?? null,
      safestType: safest?.type ?? null,
      disclaimer:
        "Nifty 50/100, equity fund category, debt fund, and liquid fund rates are live trailing CAGR figures computed from " +
        "real index/NAV history (refreshed daily); individual fund performance will vary from the benchmark used. PPF, " +
        "Government Bonds, RBI Floating Rate Bonds, and Treasury Bills remain indicative govt-notified figures. The Fixed " +
        "Deposit rate is sourced live from current bank offers. Please verify current rates before investing.",
    };
  },
};
