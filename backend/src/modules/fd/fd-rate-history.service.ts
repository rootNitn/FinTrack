import { prisma } from "../../config/prisma";
import { RateHistoryQuery } from "./fd-rate-history.dto";

function rangeCutoff(range: RateHistoryQuery["range"]): Date | null {
  const date = new Date();
  if (range === "1M") date.setMonth(date.getMonth() - 1);
  else if (range === "3M") date.setMonth(date.getMonth() - 3);
  else if (range === "6M") date.setMonth(date.getMonth() - 6);
  else if (range === "1Y") date.setFullYear(date.getFullYear() - 1);
  else return null;
  return date;
}

export const fdRateHistoryService = {
  async getHistory(bankId: string, query: RateHistoryQuery) {
    const cutoff = rangeCutoff(query.range);
    const rows = await prisma.fdRateHistory.findMany({
      where: {
        bankId,
        tenureLabel: query.tenureLabel,
        ...(cutoff ? { recordedAt: { gte: cutoff } } : {}),
      },
      orderBy: { recordedAt: "asc" },
    });
    return rows.map((r) => ({
      recordedAt: r.recordedAt.toISOString(),
      month: r.recordedAt.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      interestRate: Number(r.interestRate),
    }));
  },

  async record(bankId: string, tenureLabel: string, interestRate: number) {
    return prisma.fdRateHistory.create({ data: { bankId, tenureLabel, interestRate } });
  },

  /**
   * Experimental: naive linear-regression projection of where the rate is trending, based on
   * historical snapshots. Clearly not a real forecasting model — intended as a rough directional
   * signal only (labelled "experimental" in the UI).
   */
  async predictTrend(bankId: string, tenureLabel: string) {
    const rows = await prisma.fdRateHistory.findMany({
      where: { bankId, tenureLabel },
      orderBy: { recordedAt: "asc" },
    });

    if (rows.length < 3) {
      return { available: false as const, message: "Not enough historical data for a prediction." };
    }

    const t0 = rows[0].recordedAt.getTime();
    const points = rows.map((r) => ({
      x: (r.recordedAt.getTime() - t0) / (1000 * 60 * 60 * 24 * 30), // months since first record
      y: Number(r.interestRate),
    }));

    const n = points.length;
    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumY = points.reduce((s, p) => s + p.y, 0);
    const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
    const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
    const denominator = n * sumXX - sumX * sumX;
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    const intercept = (sumY - slope * sumX) / n;

    const lastX = points[points.length - 1].x;
    const predictedIn3Months = Number((intercept + slope * (lastX + 3)).toFixed(2));
    const currentRate = points[points.length - 1].y;

    return {
      available: true as const,
      currentRate,
      predictedRateIn3Months: predictedIn3Months,
      trend: predictedIn3Months > currentRate ? "UP" : predictedIn3Months < currentRate ? "DOWN" : "FLAT",
      slopePerMonth: Number(slope.toFixed(4)),
      disclaimer: "Experimental projection based on simple linear regression of past rate changes. Not financial advice.",
    };
  },
};
