/* eslint-disable no-console */
// Standalone seed script for the Fixed Deposit module — only touches fd_* tables,
// safe to re-run without wiping any other user data. Run with: tsx prisma/seed-fd.ts
import { PrismaClient, FdBankType, FdCompoundingFrequency } from "@prisma/client";

const prisma = new PrismaClient();

interface BankSeed {
  name: string;
  bankType: FdBankType;
  rating: number;
  minDeposit: number;
  maxDeposit?: number;
  depositInsuranceCover: number;
  pros: string[];
  cons: string[];
  features: string[];
  prematureWithdrawalRules: string;
  penaltyRules: string;
  taxInfo: string;
  customerSupportPhone: string;
  customerSupportEmail: string;
  websiteUrl: string;
  rates: { tenureLabel: string; tenureMinDays: number; tenureMaxDays: number; rate: number; seniorRate: number }[];
}

const TENURES = [
  { tenureLabel: "7 Days - 45 Days", tenureMinDays: 7, tenureMaxDays: 45 },
  { tenureLabel: "46 Days - 179 Days", tenureMinDays: 46, tenureMaxDays: 179 },
  { tenureLabel: "180 Days - 1 Year", tenureMinDays: 180, tenureMaxDays: 364 },
  { tenureLabel: "1 Year", tenureMinDays: 365, tenureMaxDays: 365 },
  { tenureLabel: "2 Years", tenureMinDays: 730, tenureMaxDays: 730 },
  { tenureLabel: "3 Years", tenureMinDays: 1095, tenureMaxDays: 1095 },
  { tenureLabel: "5 Years", tenureMinDays: 1825, tenureMaxDays: 1825 },
];

function ratesFor(base: number[]): BankSeed["rates"] {
  return TENURES.map((t, i) => ({ ...t, rate: base[i], seniorRate: Number((base[i] + 0.5).toFixed(2)) }));
}

const BANKS: BankSeed[] = [
  {
    name: "State Bank of India",
    bankType: "PUBLIC",
    rating: 4.3,
    minDeposit: 1000,
    maxDeposit: 20000000,
    depositInsuranceCover: 500000,
    pros: ["Widest branch network in India", "Trusted public sector bank", "Easy premature withdrawal"],
    cons: ["Lower rates than small finance banks", "Slower digital account opening"],
    features: ["Auto-renewal", "Loan against FD up to 90%", "Nomination facility"],
    prematureWithdrawalRules: "Allowed anytime with a penalty; no penalty for withdrawals below ₹5 lakh after 7 days.",
    penaltyRules: "0.50% penalty on the applicable rate for premature withdrawal.",
    taxInfo: "Interest is taxable as per your income slab; TDS deducted if interest exceeds ₹40,000/year (₹50,000 for senior citizens).",
    customerSupportPhone: "1800-1234",
    customerSupportEmail: "support@sbi.co.in",
    websiteUrl: "https://sbi.co.in",
    rates: ratesFor([3.5, 4.75, 6.5, 6.8, 7.0, 6.75, 6.5]),
  },
  {
    name: "HDFC Bank",
    bankType: "PRIVATE",
    rating: 4.5,
    minDeposit: 5000,
    maxDeposit: 20000000,
    depositInsuranceCover: 500000,
    pros: ["Strong digital banking experience", "Flexible tenure options", "Quick online FD booking"],
    cons: ["Minimum deposit higher than public banks", "Penalty on early withdrawal"],
    features: ["Sweep-in facility", "Auto-renewal", "Loan against FD up to 90%"],
    prematureWithdrawalRules: "Allowed anytime; penalty applies except for deposits below ₹5 lakh held over a year.",
    penaltyRules: "1% penalty on the rate applicable for the period the deposit remained with the bank.",
    taxInfo: "Interest is taxable as per income slab; TDS applies above ₹40,000/year threshold.",
    customerSupportPhone: "1800-202-6161",
    customerSupportEmail: "support@hdfcbank.com",
    websiteUrl: "https://hdfcbank.com",
    rates: ratesFor([3.0, 4.5, 6.6, 6.9, 7.1, 7.0, 6.6]),
  },
  {
    name: "ICICI Bank",
    bankType: "PRIVATE",
    rating: 4.4,
    minDeposit: 10000,
    maxDeposit: 20000000,
    depositInsuranceCover: 500000,
    pros: ["Competitive senior citizen rates", "Robust mobile app", "Wide ATM network"],
    cons: ["Higher minimum deposit for some tenures", "Penalty for withdrawal in first 7 days"],
    features: ["Flexible payout options", "Auto-renewal", "Tax-saver FD available"],
    prematureWithdrawalRules: "No withdrawal within the first 7 days; allowed with penalty thereafter.",
    penaltyRules: "1% penalty on the applicable rate for premature withdrawal.",
    taxInfo: "Interest taxable as per slab; TDS deducted beyond ₹40,000/year (₹50,000 for senior citizens).",
    customerSupportPhone: "1800-1080",
    customerSupportEmail: "customer.care@icicibank.com",
    websiteUrl: "https://icicibank.com",
    rates: ratesFor([3.0, 4.5, 6.7, 7.0, 7.2, 7.0, 6.5]),
  },
  {
    name: "Axis Bank",
    bankType: "PRIVATE",
    rating: 4.2,
    minDeposit: 5000,
    maxDeposit: 20000000,
    depositInsuranceCover: 500000,
    pros: ["Good rates on special tenures", "Simple online renewal", "Overdraft against FD"],
    cons: ["Customer service response time varies", "Penalty applies uniformly"],
    features: ["Auto-renewal", "Loan/overdraft against FD", "Nomination facility"],
    prematureWithdrawalRules: "Allowed anytime with a penalty of 1% on the applicable rate.",
    penaltyRules: "1% penalty on the rate applicable for the actual period the deposit was held.",
    taxInfo: "Interest taxable as per income slab; TDS beyond ₹40,000/year threshold.",
    customerSupportPhone: "1860-419-5555",
    customerSupportEmail: "support@axisbank.com",
    websiteUrl: "https://axisbank.com",
    rates: ratesFor([3.0, 4.75, 6.7, 7.1, 7.25, 7.1, 6.6]),
  },
  {
    name: "Equitas Small Finance Bank",
    bankType: "SMALL_FINANCE",
    rating: 4.0,
    minDeposit: 1000,
    maxDeposit: 20000000,
    depositInsuranceCover: 500000,
    pros: ["Among the highest FD rates in the market", "Low minimum deposit", "Attractive senior citizen bonus"],
    cons: ["Smaller branch network", "Less brand recognition than large private banks"],
    features: ["Auto-renewal", "Loan against FD", "Doorstep banking in select cities"],
    prematureWithdrawalRules: "Allowed anytime; penalty of 1% applies on the applicable rate.",
    penaltyRules: "1% penalty on the applicable rate for premature withdrawal.",
    taxInfo: "Interest taxable as per slab; TDS deducted beyond ₹40,000/year threshold.",
    customerSupportPhone: "1800-419-1155",
    customerSupportEmail: "customercare@equitasbank.com",
    websiteUrl: "https://equitasbank.com",
    rates: ratesFor([4.0, 5.5, 7.5, 8.0, 8.25, 7.75, 7.25]),
  },
  {
    name: "Bajaj Finance (NBFC)",
    bankType: "NBFC",
    rating: 4.6,
    minDeposit: 15000,
    maxDeposit: 50000000,
    depositInsuranceCover: 0,
    pros: ["Highest rated NBFC FD (AAA rating)", "Attractive rates for higher tenures", "Flexible payout frequency"],
    cons: ["Not covered under DICGC deposit insurance", "Higher minimum deposit"],
    features: ["Flexible interest payout: monthly/quarterly/cumulative", "Online FD booking", "Systematic deposit plan"],
    prematureWithdrawalRules: "Not allowed within the first 3 months; allowed with penalty thereafter.",
    penaltyRules: "1-2% penalty depending on the tenure completed.",
    taxInfo: "Interest taxable as per slab; TDS deducted beyond ₹40,000/year threshold.",
    customerSupportPhone: "8698010101",
    customerSupportEmail: "wecare@bajajfinserv.in",
    websiteUrl: "https://bajajfinserv.in",
    rates: ratesFor([3.5, 5.0, 7.4, 7.8, 8.1, 7.95, 7.5]),
  },
];

async function main() {
  console.log("🌱 Seeding FD banks & rates (non-destructive)...");

  for (const bankSeed of BANKS) {
    const { rates, ...bankFields } = bankSeed;
    const bank = await prisma.fdBank.upsert({
      where: { name: bankSeed.name },
      update: { ...bankFields },
      create: { ...bankFields },
    });

    await prisma.fdRate.deleteMany({ where: { bankId: bank.id } });
    await prisma.fdRate.createMany({
      data: rates.map((r) => ({
        bankId: bank.id,
        tenureLabel: r.tenureLabel,
        tenureMinDays: r.tenureMinDays,
        tenureMaxDays: r.tenureMaxDays,
        interestRate: r.rate,
        seniorCitizenRate: r.seniorRate,
        compounding: FdCompoundingFrequency.QUARTERLY,
        payoutOptions: ["CUMULATIVE", "MONTHLY_INTEREST", "QUARTERLY_INTEREST"],
      })),
    });

    // Build 12 months of gently fluctuating rate history for the "1 Year" tenure so the
    // rate-history chart on the bank detail page has meaningful data out of the box.
    const oneYear = rates.find((r) => r.tenureLabel === "1 Year")!;
    await prisma.fdRateHistory.deleteMany({ where: { bankId: bank.id, tenureLabel: "1 Year" } });
    const historyRows = [];
    for (let i = 11; i >= 0; i--) {
      const recordedAt = new Date();
      recordedAt.setMonth(recordedAt.getMonth() - i);
      recordedAt.setDate(1);
      const drift = Math.sin(i / 2) * 0.15 + (Math.random() - 0.5) * 0.1;
      historyRows.push({
        bankId: bank.id,
        tenureLabel: "1 Year",
        interestRate: Number((oneYear.rate - i * 0.02 + drift).toFixed(2)),
        recordedAt,
      });
    }
    await prisma.fdRateHistory.createMany({ data: historyRows });

    console.log(`  ✓ ${bankSeed.name}`);
  }

  console.log("✅ FD module seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
