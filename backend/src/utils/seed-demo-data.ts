import { createHash } from "crypto";
import {
  AccountType,
  ExpenseCategory,
  GoalType,
  IncomeSource,
  InvestmentCategory,
  PaymentMode,
  Prisma,
  RiskLevel,
} from "@prisma/client";
import { encrypt } from "./crypto";

export async function seedDemoData(
  tx: Prisma.TransactionClient,
  userId: string,
  now = new Date()
): Promise<boolean> {
  const id = (name: string) => createHash("sha256").update(`demo-data-v1:${userId}:${name}`).digest("hex");
  const bankId = id("bank");

  // The bank is a completion marker: all sample records are committed in one transaction.
  if (await tx.bankAccount.findUnique({ where: { id: bankId } })) return false;

  const date = (monthsAgo: number, day = 1) => {
    const result = new Date(now);
    result.setDate(1);
    result.setMonth(result.getMonth() - monthsAgo);
    result.setDate(Math.min(day, monthsAgo === 0 ? now.getDate() : 28));
    result.setHours(0, 0, 0, 0);
    return result;
  };

  await tx.bankAccount.create({
    data: {
      id: bankId,
      userId,
      bankName: "Demo Savings Bank",
      ifsc: "DEMO0001234",
      accountType: AccountType.SAVINGS,
      balance: 185000,
      accountNumberEncrypted: encrypt("000000001234"),
      accountNumberLast4: "1234",
    },
  });

  const investments: Prisma.InvestmentCreateManyInput[] = [
    {
      id: id("index-fund"), userId, name: "Demo Nifty 50 Index Fund",
      category: InvestmentCategory.MUTUAL_FUNDS, principalAmount: 120000,
      currentValue: 148000, sipAmount: 5000, riskLevel: RiskLevel.MODERATE, purchaseDate: date(12),
    },
    {
      id: id("shares"), userId, name: "Demo Equity Portfolio",
      category: InvestmentCategory.STOCKS, principalAmount: 80000,
      currentValue: 92000, riskLevel: RiskLevel.HIGH, purchaseDate: date(10),
    },
    {
      id: id("deposit"), userId, name: "Demo Fixed Deposit",
      category: InvestmentCategory.FIXED_DEPOSIT, principalAmount: 200000,
      currentValue: 214000, riskLevel: RiskLevel.LOW, purchaseDate: date(12), maturityDate: date(-6),
    },
    {
      id: id("gold"), userId, name: "Demo Gold Holding",
      category: InvestmentCategory.GOLD, principalAmount: 50000,
      currentValue: 58500, riskLevel: RiskLevel.MODERATE, purchaseDate: date(8),
    },
  ];
  await tx.investment.createMany({ data: investments });

  const transactions: Prisma.TransactionCreateManyInput[] = investments.map((investment) => ({
    userId,
    type: "INVESTMENT_BUY",
    amount: investment.principalAmount,
    date: investment.purchaseDate,
    description: `Sample purchase: ${investment.name}`,
    category: investment.category,
    relatedInvestmentId: investment.id,
  }));
  const expenses: Prisma.ExpenseCreateManyInput[] = [];
  const incomes: Prisma.IncomeCreateManyInput[] = [];
  const snapshots: Prisma.MonthlySnapshotCreateManyInput[] = [];
  const categories = [
    { category: ExpenseCategory.RENT, amount: 18000 },
    { category: ExpenseCategory.FOOD, amount: 6500 },
    { category: ExpenseCategory.FUEL, amount: 2500 },
    { category: ExpenseCategory.SHOPPING, amount: 3000 },
    { category: ExpenseCategory.ENTERTAINMENT, amount: 1500 },
  ];

  for (let month = 5; month >= 0; month--) {
    let totalExpenses = 0;
    for (const [index, sample] of categories.entries()) {
      const amount = sample.amount + (sample.category === ExpenseCategory.RENT ? 0 : month * 100);
      const entryDate = date(month, 3 + index * 3);
      expenses.push({
        userId, bankAccountId: bankId, category: sample.category, amount,
        date: entryDate, paymentMode: PaymentMode.UPI, description: `Sample ${sample.category.toLowerCase()} expense`,
      });
      transactions.push({
        userId, bankAccountId: bankId, type: "EXPENSE", category: sample.category,
        amount, date: entryDate, description: `Sample ${sample.category.toLowerCase()} expense`,
      });
      totalExpenses += amount;
    }
    const salary = 95000;
    incomes.push({
      userId, bankAccountId: bankId, source: IncomeSource.SALARY,
      amount: salary, date: date(month), description: "Sample monthly salary",
    });
    transactions.push({
      userId, bankAccountId: bankId, type: "INCOME", category: IncomeSource.SALARY,
      amount: salary, date: date(month), description: "Sample monthly salary",
    });
    const snapshotDate = date(month);
    snapshots.push({
      userId, month: snapshotDate.getMonth() + 1, year: snapshotDate.getFullYear(),
      netWorth: 697500 - month * 30000, investmentValue: 512500 - month * 10000,
      income: salary, expenses: totalExpenses, savings: salary - totalExpenses,
      profit: 10500 - month * 500,
    });
  }

  await tx.expense.createMany({ data: expenses });
  await tx.income.createMany({ data: incomes });
  await tx.transaction.createMany({ data: transactions });
  await tx.goal.createMany({
    data: [
      {
        userId, name: "Demo Emergency Fund", type: GoalType.EMERGENCY_FUND,
        targetAmount: 300000, currentAmount: 185000, deadline: date(-12),
      },
      {
        userId, name: "Demo Vacation", type: GoalType.VACATION,
        targetAmount: 150000, currentAmount: 45000, deadline: date(-6),
      },
      {
        userId, name: "Demo New Car", type: GoalType.CAR,
        targetAmount: 800000, currentAmount: 120000, deadline: date(-24),
      },
    ],
  });
  await tx.monthlySnapshot.createMany({ data: snapshots, skipDuplicates: true });
  return true;
}
