const mockTx = {
  taxFinancialYear: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  taxSlab: { createMany: jest.fn() },
  taxRebateRule: { createMany: jest.fn() },
  taxSurchargeRule: { createMany: jest.fn() },
  taxCessRule: { create: jest.fn() },
  taxDeductionRule: { createMany: jest.fn() },
};
const mockTransaction = jest.fn();
jest.mock("@prisma/client", () => ({
  ...jest.requireActual("@prisma/client"),
  PrismaClient: jest.fn().mockImplementation(() => ({ $transaction: mockTransaction })),
}));
import { main } from "../../../prisma/seed-tax";

describe("production tax reference seed", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockTransaction.mockImplementation(async callback => callback(mockTx));
    mockTx.taxFinancialYear.findUnique.mockResolvedValue(null);
    mockTx.taxFinancialYear.findFirst.mockResolvedValue(null);
    mockTx.taxFinancialYear.create.mockResolvedValue({ id: "financial-year" });
    jest.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  test("creates both supported years and their full rule sets", async () => {
    await main();
    expect(mockTransaction).toHaveBeenCalledTimes(2);
    expect(mockTx.taxFinancialYear.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: "2024-25", isDefault: false }),
    });
    expect(mockTx.taxFinancialYear.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: "2025-26", isDefault: true }),
    });
    for (const model of [mockTx.taxSlab, mockTx.taxRebateRule, mockTx.taxSurchargeRule, mockTx.taxDeductionRule]) {
      expect(model.createMany).toHaveBeenCalledTimes(2);
    }
    expect(mockTx.taxCessRule.create).toHaveBeenCalledTimes(2);
  });

  test("skips existing years without overwriting their rules", async () => {
    mockTx.taxFinancialYear.findUnique.mockResolvedValue({ id: "existing" });
    await main();
    expect(mockTx.taxFinancialYear.create).not.toHaveBeenCalled();
    expect(mockTx.taxSlab.createMany).not.toHaveBeenCalled();
    expect(mockTx.taxDeductionRule.createMany).not.toHaveBeenCalled();
  });

  test("preserves an administrator's existing default year", async () => {
    mockTx.taxFinancialYear.findFirst.mockResolvedValue({ id: "admin-default" });
    await main();
    expect(mockTx.taxFinancialYear.create.mock.calls.every(([input]) => input.data.isDefault === false)).toBe(true);
  });

  test("fails explicitly when rule creation fails", async () => {
    mockTx.taxSlab.createMany.mockRejectedValue(new Error("Database unavailable"));
    await expect(main()).rejects.toThrow("Database unavailable");
  });
});
