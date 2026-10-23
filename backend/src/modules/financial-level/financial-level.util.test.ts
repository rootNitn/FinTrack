import { FINANCIAL_LEVELS, safePercent, scoreLevel } from "./financial-level.util";

describe("financial level utility", () => {
  it("maps score bands to the configured levels", () => {
    expect(scoreLevel(24).label).toBe("Financially Vulnerable");
    expect(scoreLevel(45).label).toBe("Financially Secure");
    expect(scoreLevel(79).label).toBe("Financially Strong");
  });

  it("requires progression gates for advanced levels", () => {
    const gateIds = ["emergency-fund", "positive-cash-flow", "manageable-debt", "income-diversification", "goal-progress"];
    const failedGates = gateIds.map((id, index) => ({ id, label: id, passed: index !== 0, current: index === 0 ? 2 : 100, target: 6 }));
    expect(scoreLevel(90, failedGates).name).toBe("FINANCIALLY_STRONG");
    expect(scoreLevel(90, failedGates.map((gate) => ({ ...gate, passed: true }))).name).toBe("FINANCIALLY_INDEPENDENT");
  });

  it("never divides by zero", () => {
    expect(safePercent(100, 0)).toBeNull();
    expect(safePercent(50, 200)).toBe(25);
  });

  it("keeps the configured level count stable", () => {
    expect(FINANCIAL_LEVELS).toHaveLength(6);
  });
});
