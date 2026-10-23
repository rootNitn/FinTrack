import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { prisma } from "../../config/prisma";
import { computeRoiPercent, computeSavingsRate, round2 } from "../../utils/finance-calculations.util";
import { dayKey, firstUtcDayOfMonth, lastUtcMillisecondOfMonth, monthKey, monthsAgo } from "./analytics-date.util";

export interface AnalyticsDateRange {
  startDate: Date;
  endDate: Date;
}

function inRange(date: Date, range: AnalyticsDateRange): boolean {
  return date >= range.startDate && date <= range.endDate;
}

async function buildIncomeVsExpense(userId: string, range: AnalyticsDateRange) {
  const since = range.startDate;
  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({ where: { userId, date: { gte: since, lte: range.endDate } }, select: { amount: true, date: true } }),
    prisma.expense.findMany({ where: { userId, date: { gte: since, lte: range.endDate } }, select: { amount: true, date: true } }),
  ]);

  const byMonth = new Map<string, { income: number; expense: number }>();
  incomes.forEach((i) => {
    const key = monthKey(i.date);
    const entry = byMonth.get(key) ?? { income: 0, expense: 0 };
    entry.income += Number(i.amount);
    byMonth.set(key, entry);
  });
  expenses.forEach((e) => {
    const key = monthKey(e.date);
    const entry = byMonth.get(key) ?? { income: 0, expense: 0 };
    entry.expense += Number(e.amount);
    byMonth.set(key, entry);
  });

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([label, v]) => ({
      label,
      income: round2(v.income),
      expense: round2(v.expense),
      savings: round2(v.income - v.expense),
    }));
}

async function buildExpenseHeatmap(userId: string, range: AnalyticsDateRange) {
  const since = range.startDate;
  const expenses = await prisma.expense.findMany({
    where: { userId, date: { gte: since, lte: range.endDate } },
    select: { amount: true, date: true },
  });

  const byDay = new Map<string, number>();
  expenses.forEach((e) => {
    const key = dayKey(e.date);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(e.amount));
  });

  return Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, value]) => ({ date, value: round2(value) }));
}

async function buildMonthlySavingsRate(userId: string, range: AnalyticsDateRange) {
  const incomeVsExpense = await buildIncomeVsExpense(userId, range);
  return incomeVsExpense.map((m) => ({
    label: m.label,
    income: m.income,
    expense: m.expense,
    savingsRate: computeSavingsRate(m.income, m.expense).savingsRatePercent,
  }));
}

async function buildNetWorthGrowth(userId: string, range: AnalyticsDateRange) {
  const snapshots = await prisma.monthlySnapshot.findMany({
    where: { userId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 120,
  });
  return snapshots.filter((s) => inRange(firstUtcDayOfMonth(s.year, s.month), range)).slice(0, 24).reverse().map((s) => ({
    label: `${s.year}-${String(s.month).padStart(2, "0")}`,
    netWorth: round2(Number(s.netWorth)),
  }));
}

async function buildInvestmentPerformance(userId: string, range: AnalyticsDateRange) {
  const [investments, snapshots] = await Promise.all([
    prisma.investment.findMany({ where: { userId }, select: { principalAmount: true, purchaseDate: true, currentValue: true, category: true } }),
    prisma.monthlySnapshot.findMany({
      where: { userId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 120,
    }),
  ]);

  const totalInvested = investments.reduce((sum, i) => sum + Number(i.principalAmount), 0);
  const currentValue = investments.reduce((sum, i) => sum + Number(i.currentValue), 0);
  const totalProfit = currentValue - totalInvested;
  const roiPercent = computeRoiPercent(totalInvested, currentValue);

  const byCategory = new Map<string, { invested: number; currentValue: number }>();
  investments.forEach((inv) => {
    const entry = byCategory.get(inv.category) ?? { invested: 0, currentValue: 0 };
    entry.invested += Number(inv.principalAmount);
    entry.currentValue += Number(inv.currentValue);
    byCategory.set(inv.category, entry);
  });

  const categoryPerformance = Array.from(byCategory.entries())
    .map(([category, v]) => {
      const profit = v.currentValue - v.invested;
      return {
        category,
        invested: round2(v.invested),
        currentValue: round2(v.currentValue),
        profit: round2(profit),
        roiPercent: computeRoiPercent(v.invested, v.currentValue),
      };
    })
    .sort((a, b) => b.currentValue - a.currentValue);

  const trend = snapshots.filter((s) => inRange(firstUtcDayOfMonth(s.year, s.month), range)).slice(0, 24).reverse().map((s) => ({
    label: `${s.year}-${String(s.month).padStart(2, "0")}`,
    principalAmount: round2(investments
      .filter((investment) => investment.purchaseDate <= lastUtcMillisecondOfMonth(s.year, s.month))
      .reduce((sum, investment) => sum + Number(investment.principalAmount), 0)),
    investmentValue: round2(Number(s.investmentValue)),
  }));

  return {
    totalInvested: round2(totalInvested),
    currentValue: round2(currentValue),
    totalProfit: round2(totalProfit),
    roiPercent: round2(roiPercent),
    categoryPerformance,
    trend,
  };
}

async function buildCategorySpending(userId: string, range: AnalyticsDateRange) {
  const since = range.startDate;
  const expenses = await prisma.expense.findMany({
    where: { userId, date: { gte: since, lte: range.endDate } },
    select: { amount: true, category: true },
  });

  const byCategory = new Map<string, number>();
  let total = 0;
  expenses.forEach((e) => {
    const amount = Number(e.amount);
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amount);
    total += amount;
  });

  return Array.from(byCategory.entries())
    .map(([category, amount]) => ({
      category,
      amount: round2(amount),
      percent: total > 0 ? round2((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

async function buildYearOverYear(userId: string, range: AnalyticsDateRange, fiscalYearStartMonth: number) {
  const [incomes, expenses, snapshots] = await Promise.all([
    prisma.income.findMany({ where: { userId, date: { gte: range.startDate, lte: range.endDate } }, select: { amount: true, date: true } }),
    prisma.expense.findMany({ where: { userId, date: { gte: range.startDate, lte: range.endDate } }, select: { amount: true, date: true } }),
    prisma.monthlySnapshot.findMany({ where: { userId }, orderBy: [{ year: "desc" }, { month: "desc" }], take: 120 }),
  ]);

  // Fiscal year of a date: dates before the start month belong to the PRECEDING fiscal year
  // (e.g. with startMonth=4/April, Feb 2026 is FY2025, but Apr 2026 is FY2026). startMonth=1
  // (January) makes this identical to a plain calendar year — the pre-existing default behavior.
  const fiscalYearOf = (date: Date) => (date.getUTCMonth() + 1 >= fiscalYearStartMonth ? date.getUTCFullYear() : date.getUTCFullYear() - 1);

  const byYear = new Map<number, { income: number; expense: number }>();
  incomes.forEach((i) => {
    const year = fiscalYearOf(i.date);
    const entry = byYear.get(year) ?? { income: 0, expense: 0 };
    entry.income += Number(i.amount);
    byYear.set(year, entry);
  });
  expenses.forEach((e) => {
    const year = fiscalYearOf(e.date);
    const entry = byYear.get(year) ?? { income: 0, expense: 0 };
    entry.expense += Number(e.amount);
    byYear.set(year, entry);
  });

  // Latest snapshot per year gives an end-of-year net worth approximation.
  const netWorthByYear = new Map<number, number>();
  snapshots.filter((s) => inRange(firstUtcDayOfMonth(s.year, s.month), range)).forEach((s) => {
    const year = fiscalYearOf(firstUtcDayOfMonth(s.year, s.month));
    if (!netWorthByYear.has(year)) netWorthByYear.set(year, Number(s.netWorth));
  });

  const years = Array.from(byYear.keys()).sort((a, b) => a - b);
  let prev: { income: number; expense: number; netWorth: number } | null = null;

  return years.map((year) => {
    const v = byYear.get(year)!;
    const netWorth = netWorthByYear.get(year) ?? 0;
    const savings = v.income - v.expense;
    const row = {
      year,
      income: round2(v.income),
      expense: round2(v.expense),
      savings: round2(savings),
      netWorth: round2(netWorth),
      incomeGrowthPercent: prev && prev.income > 0 ? round2(((v.income - prev.income) / prev.income) * 100) : null,
      expenseGrowthPercent: prev && prev.expense > 0 ? round2(((v.expense - prev.expense) / prev.expense) * 100) : null,
      netWorthGrowthPercent: prev && prev.netWorth > 0 ? round2(((netWorth - prev.netWorth) / prev.netWorth) * 100) : null,
    };
    prev = { income: v.income, expense: v.expense, netWorth };
    return row;
  });
}

export const analyticsService = {
  async getAnalytics(userId: string, range?: Partial<AnalyticsDateRange>) {
    const endDate = range?.endDate ?? new Date();
    const startDate = range?.startDate ?? monthsAgo(12);
    const dateRange = { startDate, endDate };
    const setting = await prisma.setting.findUnique({ where: { userId }, select: { financialYearStartMonth: true } });
    const [
      incomeVsExpense,
      expenseHeatmap,
      monthlySavingsRate,
      netWorthGrowth,
      investmentPerformance,
      categorySpending,
      yearOverYear,
    ] = await Promise.all([
      buildIncomeVsExpense(userId, dateRange),
      buildExpenseHeatmap(userId, dateRange),
      buildMonthlySavingsRate(userId, dateRange),
      buildNetWorthGrowth(userId, dateRange),
      buildInvestmentPerformance(userId, dateRange),
      buildCategorySpending(userId, dateRange),
      buildYearOverYear(userId, dateRange, setting?.financialYearStartMonth ?? 4),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      incomeVsExpense,
      expenseHeatmap,
      monthlySavingsRate,
      netWorthGrowth,
      investmentPerformance,
      categorySpending,
      yearOverYear,
    };
  },

  async exportExcel(userId: string, range?: Partial<AnalyticsDateRange>): Promise<Buffer> {
    const data = await this.getAnalytics(userId, range);
    const workbook = new ExcelJS.Workbook();
    const addSheet = (name: string, headers: string[], rows: (string | number)[][]) => {
      const sheet = workbook.addWorksheet(name);
      sheet.columns = headers.map((header) => ({ header, key: header, width: Math.max(14, header.length + 2) }));
      sheet.getRow(1).font = { bold: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      for (const row of rows) sheet.addRow(row);
    };

    addSheet("Income vs Expense", ["Month", "Income", "Expense", "Savings"], data.incomeVsExpense.map((row) => [row.label, row.income, row.expense, row.savings]));
    addSheet("Savings Rate", ["Month", "Income", "Expense", "Savings Rate %"], data.monthlySavingsRate.map((row) => [row.label, row.income, row.expense, row.savingsRate]));
    addSheet("Expense Heatmap", ["Date", "Expense"], data.expenseHeatmap.map((row) => [row.date, row.value]));
    addSheet("Net Worth", ["Month", "Net Worth"], data.netWorthGrowth.map((row) => [row.label, row.netWorth]));
    addSheet("Investment Categories", ["Category", "Invested", "Current Value", "Profit", "ROI %"], data.investmentPerformance.categoryPerformance.map((row) => [row.category, row.invested, row.currentValue, row.profit, row.roiPercent]));
    addSheet("Category Spending", ["Category", "Amount", "Share %"], data.categorySpending.map((row) => [row.category, row.amount, row.percent]));
    addSheet("Year over Year", ["Fiscal Year", "Income", "Expense", "Savings", "Net Worth", "Income Growth %", "Expense Growth %", "Net Worth Growth %"], data.yearOverYear.map((row) => [row.year, row.income, row.expense, row.savings, row.netWorth, row.incomeGrowthPercent ?? "", row.expenseGrowthPercent ?? "", row.netWorthGrowthPercent ?? ""]));

    return Buffer.from(await workbook.xlsx.writeBuffer());
  },

  async exportPdf(userId: string, range?: Partial<AnalyticsDateRange>): Promise<Buffer> {
    const data = await this.getAnalytics(userId, range);
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const section = (title: string, rows: string[][]) => {
        if (doc.y > 730) doc.addPage();
        doc.moveDown(0.7).font("Helvetica-Bold").fontSize(12).text(title);
        doc.moveDown(0.25).font("Helvetica").fontSize(9);
        for (const row of rows) {
          if (doc.y > 760) doc.addPage();
          doc.text(row.join("   |   "), { lineGap: 2 });
        }
      };

      doc.font("Helvetica-Bold").fontSize(20).text("LifeTrack Analytics");
      doc.moveDown(0.25).font("Helvetica").fontSize(9).text(`Generated ${data.generatedAt}`);
      doc.text(`Range: ${range?.startDate?.toISOString().slice(0, 10) ?? "default"} to ${range?.endDate?.toISOString().slice(0, 10) ?? "today"}`);
      section("Income vs Expense", [
        ["Month", "Income", "Expense", "Savings"],
        ...data.incomeVsExpense.map((row) => [row.label, String(row.income), String(row.expense), String(row.savings)]),
      ]);
      section("Monthly Savings Rate", [
        ["Month", "Savings Rate %"],
        ...data.monthlySavingsRate.map((row) => [row.label, String(row.savingsRate)]),
      ]);
      section("Category Spending", [
        ["Category", "Amount", "Share %"],
        ...data.categorySpending.map((row) => [row.category, String(row.amount), String(row.percent)]),
      ]);
      section("Net Worth Growth", [
        ["Month", "Net Worth"],
        ...data.netWorthGrowth.map((row) => [row.label, String(row.netWorth)]),
      ]);
      section("Investment Performance by Category", [
        ["Category", "Invested", "Current", "Profit", "ROI %"],
        ...data.investmentPerformance.categoryPerformance.map((row) => [row.category, String(row.invested), String(row.currentValue), String(row.profit), String(row.roiPercent)]),
      ]);
      section("Year over Year", [
        ["Fiscal Year", "Income", "Expense", "Savings", "Net Worth"],
        ...data.yearOverYear.map((row) => [String(row.year), String(row.income), String(row.expense), String(row.savings), String(row.netWorth)]),
      ]);
      doc.end();
    });
  },
};
