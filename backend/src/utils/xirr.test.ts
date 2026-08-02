import { calculateXirr, CashFlow } from "./xirr.util";

describe("calculateXirr", () => {
  it("matches the exact CAGR for a simple lump-sum (2 cash flow) case", () => {
    // ₹100,000 invested, worth ₹150,000 exactly 3 years later → CAGR = 1.5^(1/3) - 1 ≈ 14.47%.
    const cashFlows: CashFlow[] = [
      { amount: -100000, date: new Date("2023-01-01") },
      { amount: 150000, date: new Date("2026-01-01") },
    ];
    const xirr = calculateXirr(cashFlows);
    expect(xirr).not.toBeNull();
    expect(xirr!).toBeCloseTo(14.47, 1);
  });

  it("computes a self-consistent XIRR for multiple SIP installments (root of the XNPV equation)", () => {
    const cashFlows: CashFlow[] = [
      { amount: -10000, date: new Date("2024-01-01") },
      { amount: -10000, date: new Date("2024-02-01") },
      { amount: -10000, date: new Date("2024-03-01") },
      { amount: -10000, date: new Date("2024-04-01") },
      { amount: -10000, date: new Date("2024-05-01") },
      { amount: -10000, date: new Date("2024-06-01") },
      { amount: 70000, date: new Date("2025-01-01") },
    ];
    const xirr = calculateXirr(cashFlows);
    expect(xirr).not.toBeNull();

    // Re-derive XNPV at the computed rate and confirm it's ~0 (i.e. it's a genuine root),
    // rather than asserting a specific magic percentage.
    const rate = xirr! / 100;
    const t0 = cashFlows[0].date.getTime();
    const msPerDay = 24 * 60 * 60 * 1000;
    const npv = cashFlows.reduce((sum, cf) => {
      const years = (cf.date.getTime() - t0) / msPerDay / 365;
      return sum + cf.amount / Math.pow(1 + rate, years);
    }, 0);
    expect(Math.abs(npv)).toBeLessThan(1);
  });

  it("returns null when there are fewer than 2 cash flows", () => {
    expect(calculateXirr([{ amount: -1000, date: new Date("2024-01-01") }])).toBeNull();
    expect(calculateXirr([])).toBeNull();
  });

  it("returns null when all cash flows have the same sign", () => {
    const cashFlows: CashFlow[] = [
      { amount: -1000, date: new Date("2024-01-01") },
      { amount: -2000, date: new Date("2024-06-01") },
    ];
    expect(calculateXirr(cashFlows)).toBeNull();
  });
});
