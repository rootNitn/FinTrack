import { computeRebate } from "./calculation-helpers.util";

describe("computeRebate", () => {
  const rule = { thresholdIncome: 700000, maxRebateAmount: 25000, marginalReliefEnabled: true };

  it("applies the full rebate at the threshold", () => {
    expect(computeRebate(700000, 25000, rule)).toBe(25000);
  });

  it("applies marginal relief just above the threshold", () => {
    expect(computeRebate(710000, 26000, rule)).toBe(16000);
  });

  it("does not apply marginal relief when disabled", () => {
    expect(computeRebate(710000, 26000, { ...rule, marginalReliefEnabled: false })).toBe(0);
  });
});
