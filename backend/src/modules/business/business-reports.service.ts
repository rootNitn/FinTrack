import { BusinessAccountType, JournalEntryStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";

const round2 = (value: number) => Number(value.toFixed(2));
const debitNormal = new Set<BusinessAccountType>([BusinessAccountType.ASSET, BusinessAccountType.INVENTORY, BusinessAccountType.EXPENSE, BusinessAccountType.COGS]);
const pnlTypes = new Set<BusinessAccountType>([BusinessAccountType.REVENUE, BusinessAccountType.COGS, BusinessAccountType.EXPENSE]);
const assetTypes = new Set<BusinessAccountType>([BusinessAccountType.ASSET, BusinessAccountType.INVENTORY]);

async function ownedBusiness(userId: string, businessId: string) {
  const business = await prisma.businessProfile.findFirst({ where: { id: businessId, userId } });
  if (!business) throw AppError.notFound("Business not found");
  return business;
}

async function postedLines(businessId: string, from?: Date, to?: Date) {
  return prisma.businessJournalLine.findMany({ where: { journalEntry: { businessId, status: JournalEntryStatus.POSTED, ...(from || to ? { entryDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) } }, include: { account: true, journalEntry: true }, orderBy: [{ journalEntry: { entryDate: "asc" } }, { account: { code: "asc" } }] });
}

function accountRows(lines: Array<{ account: { id: string; code: string; name: string; type: BusinessAccountType }; debit: unknown; credit: unknown }>) {
  const map = new Map<string, { accountId: string; code: string; name: string; type: BusinessAccountType; debit: number; credit: number; balance: number }>();
  for (const line of lines) {
    const row = map.get(line.account.id) ?? { accountId: line.account.id, code: line.account.code, name: line.account.name, type: line.account.type, debit: 0, credit: 0, balance: 0 };
    row.debit += Number(line.debit); row.credit += Number(line.credit);
    row.balance = debitNormal.has(row.type) ? row.debit - row.credit : row.credit - row.debit;
    map.set(line.account.id, row);
  }
  return Array.from(map.values()).map((row) => ({ ...row, debit: round2(row.debit), credit: round2(row.credit), balance: round2(row.balance) }));
}

export const businessReportsService = {
  async trialBalance(userId: string, businessId: string, from?: Date, to?: Date) {
    await ownedBusiness(userId, businessId);
    const rows = accountRows(await postedLines(businessId, from, to));
    return { type: "trial-balance", from: from?.toISOString() ?? null, to: to?.toISOString() ?? null, rows, totalDebit: round2(rows.reduce((sum, row) => sum + row.debit, 0)), totalCredit: round2(rows.reduce((sum, row) => sum + row.credit, 0)) };
  },

  async profitAndLoss(userId: string, businessId: string, from?: Date, to?: Date) {
    const report = await this.trialBalance(userId, businessId, from, to);
    const revenue = report.rows.filter((row) => row.type === BusinessAccountType.REVENUE).reduce((sum, row) => sum + row.balance, 0);
    const cogs = report.rows.filter((row) => row.type === BusinessAccountType.COGS).reduce((sum, row) => sum + row.balance, 0);
    const expenses = report.rows.filter((row) => row.type === BusinessAccountType.EXPENSE).reduce((sum, row) => sum + row.balance, 0);
    return { type: "profit-and-loss", from: report.from, to: report.to, revenue: round2(revenue), cogs: round2(cogs), grossProfit: round2(revenue - cogs), expenses: round2(expenses), netProfit: round2(revenue - cogs - expenses), rows: report.rows.filter((row) => pnlTypes.has(row.type)) };
  },

  async balanceSheet(userId: string, businessId: string) {
    const report = await this.trialBalance(userId, businessId);
    const assets = report.rows.filter((row) => assetTypes.has(row.type)).reduce((sum, row) => sum + row.balance, 0);
    const liabilities = report.rows.filter((row) => row.type === BusinessAccountType.LIABILITY).reduce((sum, row) => sum + row.balance, 0);
    const equity = report.rows.filter((row) => row.type === BusinessAccountType.EQUITY).reduce((sum, row) => sum + row.balance, 0);
    const retainedProfit = report.rows.filter((row) => pnlTypes.has(row.type)).reduce((sum, row) => sum + (row.type === BusinessAccountType.REVENUE ? row.balance : -row.balance), 0);
    return { type: "balance-sheet", asOf: new Date().toISOString(), assets: round2(assets), liabilities: round2(liabilities), equity: round2(equity + retainedProfit), balanced: round2(assets - liabilities - equity - retainedProfit) === 0, rows: report.rows.filter((row) => !pnlTypes.has(row.type)) };
  },

  async cashFlow(userId: string, businessId: string, from?: Date, to?: Date) {
    await ownedBusiness(userId, businessId);
    const lines = await postedLines(businessId, from, to);
    const byMonth = new Map<string, { inflow: number; outflow: number }>();
    for (const line of lines) {
      const key = `${line.journalEntry.entryDate.getFullYear()}-${String(line.journalEntry.entryDate.getMonth() + 1).padStart(2, "0")}`;
      const row = byMonth.get(key) ?? { inflow: 0, outflow: 0 };
      if (line.account.code === "1000") { row.inflow += Number(line.debit); row.outflow += Number(line.credit); }
      byMonth.set(key, row);
    }
    return { type: "cash-flow", rows: Array.from(byMonth, ([period, row]) => ({ period, inflow: round2(row.inflow), outflow: round2(row.outflow), net: round2(row.inflow - row.outflow) })) };
  },

  async generalLedger(userId: string, businessId: string, from?: Date, to?: Date) {
    await ownedBusiness(userId, businessId);
    const lines = await postedLines(businessId, from, to);
    return { type: "general-ledger", rows: lines.map((line) => ({ date: line.journalEntry.entryDate, reference: line.journalEntry.reference, description: line.journalEntry.description, accountCode: line.account.code, accountName: line.account.name, debit: Number(line.debit), credit: Number(line.credit) })) };
  },
};
