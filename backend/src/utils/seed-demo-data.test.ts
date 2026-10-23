import { Prisma, PrismaClient } from "@prisma/client";
import { decrypt } from "./crypto";
import { seedDemoData } from "./seed-demo-data";

describe("demo sample data", () => {
  const prisma = new PrismaClient();

  beforeEach(() => {
    jest.spyOn(prisma.bankAccount, "findUnique").mockResolvedValue(null);
    jest.spyOn(prisma.bankAccount, "create").mockImplementation();
    jest.spyOn(prisma.investment, "createMany").mockResolvedValue({ count: 4 });
    jest.spyOn(prisma.expense, "createMany").mockResolvedValue({ count: 30 });
    jest.spyOn(prisma.income, "createMany").mockResolvedValue({ count: 6 });
    jest.spyOn(prisma.transaction, "createMany").mockResolvedValue({ count: 40 });
    jest.spyOn(prisma.goal, "createMany").mockResolvedValue({ count: 3 });
    jest.spyOn(prisma.monthlySnapshot, "createMany").mockResolvedValue({ count: 6 });
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => prisma.$disconnect());

  test("creates linked sample records scoped only to the supplied demo user", async () => {
    const now = new Date(2026, 0, 2);
    expect(await seedDemoData(prisma, "demo-id", now)).toBe(true);
    const bank = jest.mocked(prisma.bankAccount.create).mock.calls[0][0].data;
    expect(bank.userId).toBe("demo-id");
    expect(decrypt(bank.accountNumberEncrypted)).toBe("000000001234");

    const expenses = jest.mocked(prisma.expense.createMany).mock.calls[0][0]?.data;
    const incomes = jest.mocked(prisma.income.createMany).mock.calls[0][0]?.data;
    const transactions = jest.mocked(prisma.transaction.createMany).mock.calls[0][0]?.data;
    const snapshots = jest.mocked(prisma.monthlySnapshot.createMany).mock.calls[0][0]?.data;
    expect(expenses).toHaveLength(30);
    expect(incomes).toHaveLength(6);
    expect(transactions).toHaveLength(40);
    expect(snapshots).toHaveLength(6);
    for (const rows of [expenses, incomes, transactions, snapshots]) {
      expect(Array.isArray(rows)).toBe(true);
      if (!Array.isArray(rows)) throw new Error("Expected batch data");
      for (const row of rows) expect(row.userId).toBe("demo-id");
    }
    if (!Array.isArray(expenses)) throw new Error("Expected expense batch");
    for (const row of expenses) {
      expect(row.bankAccountId).toBe(bank.id);
      expect(new Date(row.date).getTime()).toBeLessThanOrEqual(now.getTime());
    }
    expect(snapshots).toEqual(expect.arrayContaining([
      expect.objectContaining({ month: 8, year: 2025 }),
      expect.objectContaining({ month: 1, year: 2026 }),
    ]));
    expect(prisma.goal.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([expect.objectContaining({ name: "Demo Emergency Fund", userId: "demo-id" })]),
    });
  });

  test("does not write anything when the completion marker exists", async () => {
    const bank = {
      id: "marker", userId: "demo-id", bankName: "Demo Savings Bank",
      accountType: "SAVINGS" as const, balance: new Prisma.Decimal(185000),
      accountNumberEncrypted: "encrypted", accountNumberLast4: "1234", ifsc: "DEMO0001234",
      createdAt: new Date(), lastUpdated: new Date(),
    };
    jest.mocked(prisma.bankAccount.findUnique).mockResolvedValue(bank);
    expect(await seedDemoData(prisma, "demo-id")).toBe(false);
    expect(prisma.bankAccount.create).not.toHaveBeenCalled();
    expect(prisma.investment.createMany).not.toHaveBeenCalled();
    expect(prisma.expense.createMany).not.toHaveBeenCalled();
    expect(prisma.income.createMany).not.toHaveBeenCalled();
    expect(prisma.transaction.createMany).not.toHaveBeenCalled();
    expect(prisma.goal.createMany).not.toHaveBeenCalled();
    expect(prisma.monthlySnapshot.createMany).not.toHaveBeenCalled();
  });

  test("propagates errors so the caller can roll back the sample-data transaction", async () => {
    jest.mocked(prisma.investment.createMany).mockRejectedValue(new Error("Database unavailable"));
    await expect(seedDemoData(prisma, "demo-id")).rejects.toThrow("Database unavailable");
    expect(prisma.expense.createMany).not.toHaveBeenCalled();
  });
});
