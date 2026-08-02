/* eslint-disable no-console */
import { PrismaClient, InvestmentCategory, RiskLevel, ExpenseCategory, PaymentMode, IncomeSource, GoalType, AccountType } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

const ENCRYPTION_KEY = Buffer.from(
  process.env.ACCOUNT_NUMBER_ENCRYPTION_KEY ?? "a1b2c3d4e5f60718a1b2c3d4e5f60718a1b2c3d4e5f60718a1b2c3d4e5f60718",
  "hex"
);

function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

function randomBetween(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function monthsAgo(months: number, day = 1) {
  const date = new Date();
  date.setDate(1); // avoid month-rollover bugs when subtracting months from a day that doesn't exist in the target month
  date.setMonth(date.getMonth() - months);
  date.setDate(day);
  return date;
}

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.notification.deleteMany();
  await prisma.monthlySnapshot.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.income.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Demo@1234", 12);

  const demoUser = await prisma.user.create({
    data: {
      name: "Demo User",
      email: "demo@financetracker.local",
      passwordHash,
      role: "USER",
      setting: { create: { currency: "INR" } },
    },
  });

  await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@financetracker.local",
      passwordHash: await bcrypt.hash("Admin@1234", 12),
      role: "ADMIN",
      setting: { create: { currency: "INR" } },
    },
  });

  console.log("👤 Users created (demo@financetracker.local / Demo@1234, admin@financetracker.local / Admin@1234)");

  // ---- Bank accounts ----
  const bankAccountsData = [
    { bankName: "HDFC Bank", accountType: AccountType.SAVINGS, balance: 185000, ifsc: "HDFC0001234", accountNumber: "50100234567890" },
    { bankName: "ICICI Bank", accountType: AccountType.CURRENT, balance: 42000, ifsc: "ICIC0004567", accountNumber: "00340123456789" },
    { bankName: "SBI", accountType: AccountType.SALARY, balance: 76500, ifsc: "SBIN0011234", accountNumber: "31234567891" },
  ];
  const bankAccounts = [];
  for (const acc of bankAccountsData) {
    const created = await prisma.bankAccount.create({
      data: {
        userId: demoUser.id,
        bankName: acc.bankName,
        accountType: acc.accountType,
        balance: acc.balance,
        ifsc: acc.ifsc,
        accountNumberEncrypted: encrypt(acc.accountNumber),
        accountNumberLast4: acc.accountNumber.slice(-4),
      },
    });
    bankAccounts.push(created);
  }
  console.log(`🏦 ${bankAccounts.length} bank accounts created`);

  // ---- Investments across every category ----
  const investmentSeeds: Array<{
    name: string;
    category: InvestmentCategory;
    principal: number;
    current: number;
    target?: number;
    monthsAgoPurchased: number;
    sip?: number;
    risk: RiskLevel;
    maturityMonthsAhead?: number;
  }> = [
    { name: "Reliance Industries", category: InvestmentCategory.STOCKS, principal: 150000, current: 189500, target: 220000, monthsAgoPurchased: 18, risk: RiskLevel.HIGH },
    { name: "HDFC Bank Shares", category: InvestmentCategory.STOCKS, principal: 80000, current: 74000, target: 100000, monthsAgoPurchased: 10, risk: RiskLevel.HIGH },
    { name: "Axis Bluechip Fund", category: InvestmentCategory.MUTUAL_FUNDS, principal: 120000, current: 148000, target: 180000, monthsAgoPurchased: 24, sip: 5000, risk: RiskLevel.MODERATE },
    { name: "SBI Small Cap Fund", category: InvestmentCategory.MUTUAL_FUNDS, principal: 60000, current: 82000, target: 100000, monthsAgoPurchased: 20, sip: 3000, risk: RiskLevel.HIGH },
    { name: "HDFC FD 2 Year", category: InvestmentCategory.FIXED_DEPOSIT, principal: 200000, current: 214000, monthsAgoPurchased: 18, risk: RiskLevel.LOW, maturityMonthsAhead: 1 },
    { name: "SBI FD 1 Year", category: InvestmentCategory.FIXED_DEPOSIT, principal: 100000, current: 106500, monthsAgoPurchased: 8, risk: RiskLevel.LOW, maturityMonthsAhead: 4 },
    { name: "PPF Account", category: InvestmentCategory.PPF, principal: 150000, current: 172000, target: 300000, monthsAgoPurchased: 36, sip: 4000, risk: RiskLevel.LOW },
    { name: "EPF Balance", category: InvestmentCategory.EPF, principal: 220000, current: 248000, target: 400000, monthsAgoPurchased: 48, risk: RiskLevel.LOW },
    { name: "NPS Tier 1", category: InvestmentCategory.NPS, principal: 90000, current: 101500, target: 200000, monthsAgoPurchased: 30, sip: 2000, risk: RiskLevel.MODERATE },
    { name: "Digital Gold", category: InvestmentCategory.GOLD, principal: 50000, current: 58500, target: 70000, monthsAgoPurchased: 14, risk: RiskLevel.MODERATE },
    { name: "Sovereign Gold Bond", category: InvestmentCategory.GOLD, principal: 40000, current: 46200, monthsAgoPurchased: 22, risk: RiskLevel.LOW },
    { name: "Bitcoin", category: InvestmentCategory.CRYPTO, principal: 35000, current: 41800, target: 60000, monthsAgoPurchased: 12, risk: RiskLevel.HIGH },
    { name: "Ethereum", category: InvestmentCategory.CRYPTO, principal: 20000, current: 17200, monthsAgoPurchased: 9, risk: RiskLevel.HIGH },
    { name: "Government Bonds", category: InvestmentCategory.BONDS, principal: 75000, current: 79500, monthsAgoPurchased: 16, risk: RiskLevel.LOW },
    { name: "Rental Property - Pune", category: InvestmentCategory.REAL_ESTATE, principal: 2500000, current: 2950000, target: 3500000, monthsAgoPurchased: 40, risk: RiskLevel.MODERATE },
    { name: "Emergency Cash Reserve", category: InvestmentCategory.CASH, principal: 100000, current: 100000, monthsAgoPurchased: 6, risk: RiskLevel.LOW },
    { name: "Corporate Bond Fund", category: InvestmentCategory.OTHER, principal: 30000, current: 31200, monthsAgoPurchased: 11, risk: RiskLevel.MODERATE },
    { name: "Nifty 50 Index Fund", category: InvestmentCategory.MUTUAL_FUNDS, principal: 90000, current: 108000, target: 130000, monthsAgoPurchased: 20, sip: 4000, risk: RiskLevel.MODERATE },
    { name: "Infosys Shares", category: InvestmentCategory.STOCKS, principal: 60000, current: 71500, target: 85000, monthsAgoPurchased: 15, risk: RiskLevel.HIGH },
    { name: "Post Office FD", category: InvestmentCategory.FIXED_DEPOSIT, principal: 50000, current: 52800, monthsAgoPurchased: 5, risk: RiskLevel.LOW, maturityMonthsAhead: 7 },
  ];

  for (const seed of investmentSeeds) {
    const purchaseDate = monthsAgo(seed.monthsAgoPurchased, 5);
    const maturityDate = seed.maturityMonthsAhead
      ? (() => {
          const d = new Date();
          d.setMonth(d.getMonth() + seed.maturityMonthsAhead!);
          return d;
        })()
      : undefined;

    const investment = await prisma.investment.create({
      data: {
        userId: demoUser.id,
        name: seed.name,
        category: seed.category,
        account: "Primary Demat / Bank",
        principalAmount: seed.principal,
        currentValue: seed.current,
        targetValue: seed.target,
        purchaseDate,
        maturityDate,
        sipAmount: seed.sip,
        riskLevel: seed.risk,
        status: "ACTIVE",
        notes: `Seeded demo holding in ${seed.category}`,
      },
    });

    await prisma.transaction.create({
      data: {
        userId: demoUser.id,
        type: "INVESTMENT_BUY",
        amount: seed.principal,
        date: purchaseDate,
        description: `Purchased ${seed.name}`,
        category: seed.category,
        relatedInvestmentId: investment.id,
      },
    });

    if (seed.sip) {
      for (let m = 1; m <= 6; m++) {
        await prisma.transaction.create({
          data: {
            userId: demoUser.id,
            type: "SIP",
            amount: seed.sip,
            date: monthsAgo(m, 5),
            description: `SIP installment for ${seed.name}`,
            category: seed.category,
            relatedInvestmentId: investment.id,
          },
        });
      }
    }
  }
  console.log(`📈 ${investmentSeeds.length} investments created across all categories`);

  // ---- Expenses: 6 months across all categories ----
  const expenseCategories = Object.values(ExpenseCategory);
  const paymentModes = Object.values(PaymentMode);
  let expenseCount = 0;
  for (let m = 0; m < 6; m++) {
    for (const category of expenseCategories) {
      const amount =
        category === ExpenseCategory.RENT
          ? 18000
          : category === ExpenseCategory.EMI
          ? 12000
          : randomBetween(500, 6000);
      await prisma.expense.create({
        data: {
          userId: demoUser.id,
          date: monthsAgo(m, Math.min(28, 5 + expenseCategories.indexOf(category))),
          category,
          amount,
          paymentMode: paymentModes[expenseCategories.indexOf(category) % paymentModes.length],
          description: `${category} expense`,
          bankAccountId: bankAccounts[0].id,
        },
      });
      await prisma.transaction.create({
        data: {
          userId: demoUser.id,
          type: "EXPENSE",
          amount,
          date: monthsAgo(m, Math.min(28, 5 + expenseCategories.indexOf(category))),
          description: `${category} expense`,
          category,
          bankAccountId: bankAccounts[0].id,
        },
      });
      expenseCount++;
    }
  }
  console.log(`💸 ${expenseCount} expenses created`);

  // ---- Income: 6 months across sources ----
  let incomeCount = 0;
  for (let m = 0; m < 6; m++) {
    await prisma.income.create({
      data: {
        userId: demoUser.id,
        date: monthsAgo(m, 1),
        source: IncomeSource.SALARY,
        amount: 95000,
        description: "Monthly salary",
        bankAccountId: bankAccounts[2].id,
      },
    });
    await prisma.transaction.create({
      data: { userId: demoUser.id, type: "INCOME", amount: 95000, date: monthsAgo(m, 1), description: "Monthly salary", category: "SALARY", bankAccountId: bankAccounts[2].id },
    });
    incomeCount += 2;

    if (m % 2 === 0) {
      const amount = randomBetween(8000, 20000);
      await prisma.income.create({
        data: { userId: demoUser.id, date: monthsAgo(m, 15), source: IncomeSource.FREELANCING, amount, description: "Freelance project", bankAccountId: bankAccounts[0].id },
      });
      incomeCount++;
    }
    const interest = randomBetween(200, 1200);
    await prisma.income.create({
      data: { userId: demoUser.id, date: monthsAgo(m, 28), source: IncomeSource.INTEREST, amount: interest, description: "Savings account interest", bankAccountId: bankAccounts[0].id },
    });
    incomeCount++;
  }
  console.log(`💰 ${incomeCount} income entries created`);

  // ---- Goals ----
  await prisma.goal.createMany({
    data: [
      { userId: demoUser.id, name: "Emergency Fund", type: GoalType.EMERGENCY_FUND, targetAmount: 300000, currentAmount: 210000, deadline: monthsAgo(-6, 1) },
      { userId: demoUser.id, name: "Dream House Down Payment", type: GoalType.HOUSE, targetAmount: 2000000, currentAmount: 650000, deadline: monthsAgo(-30, 1) },
      { userId: demoUser.id, name: "New Car", type: GoalType.CAR, targetAmount: 800000, currentAmount: 320000, deadline: monthsAgo(-14, 1) },
      { userId: demoUser.id, name: "Bali Vacation", type: GoalType.VACATION, targetAmount: 150000, currentAmount: 95000, deadline: monthsAgo(-4, 1) },
      { userId: demoUser.id, name: "Retirement Corpus", type: GoalType.RETIREMENT, targetAmount: 15000000, currentAmount: 1800000, deadline: monthsAgo(-240, 1) },
      { userId: demoUser.id, name: "Child Education", type: GoalType.CHILD_EDUCATION, targetAmount: 2500000, currentAmount: 400000, deadline: monthsAgo(-120, 1) },
    ],
  });
  console.log("🎯 6 goals created");

  // ---- Monthly snapshots (last 12 months) for Net Worth Growth chart ----
  let baseNetWorth = 3800000;
  for (let m = 11; m >= 0; m--) {
    const date = monthsAgo(m, 1);
    const growth = randomBetween(-15000, 45000);
    baseNetWorth += growth;
    await prisma.monthlySnapshot.create({
      data: {
        userId: demoUser.id,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        netWorth: baseNetWorth,
        investmentValue: baseNetWorth * 0.75,
        income: 95000 + randomBetween(0, 15000),
        expenses: randomBetween(35000, 55000),
        savings: randomBetween(30000, 60000),
        profit: randomBetween(5000, 25000),
      },
    });
  }
  console.log("📊 12 monthly snapshots created");

  // ---- Notifications ----
  await prisma.notification.createMany({
    data: [
      { userId: demoUser.id, type: "MONTHLY_SUMMARY", title: "Monthly summary ready", message: "Your last month's financial summary is ready to view." },
      { userId: demoUser.id, type: "SIP_REMINDER", title: "SIP due soon", message: "Your SIP for Axis Bluechip Fund is due in 3 days." },
      { userId: demoUser.id, type: "GOAL_ACHIEVEMENT", title: "Goal milestone", message: "You're 70% of the way to your Emergency Fund goal!" },
    ],
  });
  console.log("🔔 Sample notifications created");

  console.log("✅ Seed complete!");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
