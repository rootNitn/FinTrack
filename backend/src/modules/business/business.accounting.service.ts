import { BusinessAccountType, BusinessEntryType, BusinessMemberRole, BusinessType, JournalEntryStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import {
  CreateBusinessAccountInput,
  CreateBusinessProfileInput,
  CreateJournalEntryInput,
} from "./business.accounting.dto";
import { assertBusinessPeriodOpen } from "./business-controls.service";
import { createBusinessJournalEntry } from "./business-journal.util";

const round2 = (value: number) => Number(value.toFixed(2));

const DEFAULT_ACCOUNTS: Array<{ code: string; name: string; type: BusinessAccountType }> = [
  { code: "1000", name: "Cash and Bank", type: BusinessAccountType.ASSET },
  { code: "1200", name: "Raw Materials Inventory", type: BusinessAccountType.INVENTORY },
  { code: "1300", name: "Work in Progress Inventory", type: BusinessAccountType.INVENTORY },
  { code: "1400", name: "Finished Goods Inventory", type: BusinessAccountType.INVENTORY },
  { code: "2000", name: "Accounts Payable", type: BusinessAccountType.LIABILITY },
  { code: "3000", name: "Owner Equity", type: BusinessAccountType.EQUITY },
  { code: "4000", name: "Sales Revenue", type: BusinessAccountType.REVENUE },
  { code: "5000", name: "Cost of Goods Sold", type: BusinessAccountType.COGS },
  { code: "6000", name: "Operating Expenses", type: BusinessAccountType.EXPENSE },
];

const DEBIT_NORMAL_TYPES = new Set<BusinessAccountType>([
  BusinessAccountType.ASSET,
  BusinessAccountType.INVENTORY,
  BusinessAccountType.EXPENSE,
  BusinessAccountType.COGS,
]);

export function assertBalancedJournal(lines: Array<{ debit: number; credit: number }>) {
  const debitTotal = lines.reduce((sum, line) => sum + line.debit, 0);
  const creditTotal = lines.reduce((sum, line) => sum + line.credit, 0);
  if (round2(debitTotal) !== round2(creditTotal)) {
    throw AppError.badRequest("Journal entry is not balanced: debits must equal credits");
  }
}

async function findOwnedBusiness(userId: string, businessId: string) {
  const business = await prisma.businessProfile.findFirst({ where: { id: businessId, userId } });
  if (!business) throw AppError.notFound("Business not found");
  return business;
}

async function findJournalAccessibleBusiness(userId: string, businessId: string) {
  const business = await prisma.businessProfile.findFirst({
    where: {
      id: businessId,
      OR: [
        { userId },
        { members: { some: { userId, isActive: true, role: BusinessMemberRole.MANAGER } } },
      ],
    },
  });
  if (!business) throw AppError.notFound("Business not found");
  return business;
}

async function assertJournalApprover(userId: string, businessId: string) {
  await findJournalAccessibleBusiness(userId, businessId);
}

async function createDefaultAccounts(tx: Prisma.TransactionClient, businessId: string) {
  await tx.businessAccount.createMany({
    data: DEFAULT_ACCOUNTS.map((account) => ({ ...account, businessId })),
    skipDuplicates: true,
  });
}

async function createDefaultWarehouse(tx: Prisma.TransactionClient, businessId: string) {
  await tx.businessWarehouse.create({ data: { businessId, name: "Main Warehouse", location: null } });
}

async function accountMap(tx: Prisma.TransactionClient, businessId: string) {
  const accounts = await tx.businessAccount.findMany({ where: { businessId } });
  return new Map(accounts.map((account) => [account.code, account]));
}

export const businessAccountingService = {
  async listBusinesses(userId: string) {
    const businesses = await prisma.businessProfile.findMany({
      where: {
        OR: [
          { userId },
          { members: { some: { userId, isActive: true, role: BusinessMemberRole.MANAGER } } },
        ],
      },
      include: { _count: { select: { accounts: true, journalEntries: true } } },
      orderBy: { createdAt: "asc" },
    });
    return businesses.map((business) => ({ ...business, currentUserRole: business.userId === userId ? "OWNER" as const : "MANAGER" as const }));
  },

  async createBusiness(userId: string, input: CreateBusinessProfileInput) {
    return prisma.$transaction(async (tx) => {
      const business = await tx.businessProfile.create({ data: { ...input, userId } });
      await createDefaultAccounts(tx, business.id);
      await createDefaultWarehouse(tx, business.id);
      return tx.businessProfile.findUniqueOrThrow({ where: { id: business.id }, include: { accounts: true } });
    });
  },

  async createAccount(userId: string, businessId: string, input: CreateBusinessAccountInput) {
    await findOwnedBusiness(userId, businessId);
    return prisma.businessAccount.create({ data: { ...input, businessId } });
  },

  async listAccounts(userId: string, businessId: string) {
    await findOwnedBusiness(userId, businessId);
    return prisma.businessAccount.findMany({ where: { businessId, isActive: true }, orderBy: { code: "asc" } });
  },

  async createJournalEntry(userId: string, input: CreateJournalEntryInput) {
    await findOwnedBusiness(userId, input.businessId);
    await assertBusinessPeriodOpen(input.businessId, input.entryDate);
    assertBalancedJournal(input.lines);

    const accountIds = input.lines.map((line) => line.accountId);
    const accounts = await prisma.businessAccount.findMany({ where: { id: { in: accountIds }, businessId: input.businessId, isActive: true } });
    if (accounts.length !== new Set(accountIds).size) throw AppError.badRequest("Every journal line must use an active account from this business");

    return prisma.$transaction(async (tx) => createBusinessJournalEntry(tx, {
        businessId: input.businessId,
        entryDate: input.entryDate,
        reference: input.reference,
        description: input.description,
        createdByUserId: userId,
        status: JournalEntryStatus.PENDING_APPROVAL,
        lines: input.lines,
      }).then(async (entry) => {
        return tx.businessJournalEntry.findUniqueOrThrow({ where: { id: entry.id }, include: { lines: { include: { account: true } }, reversalEntry: true } });
      }),
    );
  },

  async listJournalEntries(userId: string, businessId: string) {
    await findJournalAccessibleBusiness(userId, businessId);
    return prisma.businessJournalEntry.findMany({
      where: { businessId },
      include: { lines: { include: { account: true } }, reversalEntry: true },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
  },

  async listPendingJournalApprovals(userId: string) {
    return prisma.businessJournalEntry.findMany({
      where: {
        status: JournalEntryStatus.PENDING_APPROVAL,
        business: {
          OR: [
            { userId },
            { members: { some: { userId, isActive: true, role: BusinessMemberRole.MANAGER } } },
          ],
        },
      },
      include: { business: { select: { id: true, name: true } }, lines: { include: { account: true } } },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
      take: 200,
    });
  },

  async approveJournalEntry(userId: string, id: string) {
    const entry = await prisma.businessJournalEntry.findUnique({ where: { id } });
    if (!entry) throw AppError.notFound("Journal entry not found");
    await assertJournalApprover(userId, entry.businessId);
    if (entry.status !== JournalEntryStatus.PENDING_APPROVAL) throw AppError.badRequest("Only pending journal entries can be approved");
    return prisma.businessJournalEntry.update({
      where: { id },
      data: { status: JournalEntryStatus.POSTED, approvedByUserId: userId, approvedAt: new Date(), rejectionReason: null, rejectedByUserId: null },
      include: { lines: { include: { account: true } }, reversalEntry: true },
    });
  },

  async rejectJournalEntry(userId: string, id: string, reason: string) {
    const entry = await prisma.businessJournalEntry.findUnique({ where: { id } });
    if (!entry) throw AppError.notFound("Journal entry not found");
    await assertJournalApprover(userId, entry.businessId);
    if (entry.status !== JournalEntryStatus.PENDING_APPROVAL) throw AppError.badRequest("Only pending journal entries can be rejected");
    return prisma.businessJournalEntry.update({
      where: { id },
      data: { status: JournalEntryStatus.REJECTED, rejectedByUserId: userId, rejectionReason: reason },
      include: { lines: { include: { account: true } } },
    });
  },

  async reverseJournalEntry(userId: string, id: string, entryDate = new Date()) {
    const existing = await prisma.businessJournalEntry.findFirst({
      where: { id },
      include: { lines: true, reversalEntry: true },
    });
    if (!existing) throw AppError.notFound("Journal entry not found");
    await findOwnedBusiness(userId, existing.businessId);
    if (existing.status !== JournalEntryStatus.POSTED) throw AppError.badRequest("Only posted journal entries can be reversed");
    if (existing.reversalEntry) throw AppError.badRequest("This journal entry has already been reversed");
    await assertBusinessPeriodOpen(existing.businessId, entryDate);

    return prisma.$transaction(async (tx) => {
      const reversal = await createBusinessJournalEntry(tx, {
        businessId: existing.businessId,
        entryDate,
        reference: `REV-${existing.reference ?? existing.id.slice(0, 8)}`,
        description: `Reversal of ${existing.description}`,
        createdByUserId: userId,
        status: JournalEntryStatus.POSTED,
        lines: existing.lines.map((line) => ({
          accountId: line.accountId,
          debit: line.credit,
          credit: line.debit,
          description: line.description,
        })),
      });
      return tx.businessJournalEntry.update({
        where: { id: reversal.id },
        data: { reversalOfId: existing.id },
        include: { lines: { include: { account: true } }, reversalOf: true },
      });
    });
  },

  async summary(userId: string, businessId: string) {
    await findOwnedBusiness(userId, businessId);
    const lines = await prisma.businessJournalLine.findMany({
      where: { journalEntry: { businessId, status: JournalEntryStatus.POSTED } },
      include: { account: true, journalEntry: { select: { status: true } } },
    });
    const postedLines = lines.filter((line) => line.journalEntry.status === JournalEntryStatus.POSTED);
    const balances = new Map<string, { accountId: string; code: string; name: string; type: BusinessAccountType; debit: number; credit: number; balance: number }>();
    for (const line of postedLines) {
      const current = balances.get(line.accountId) ?? { accountId: line.accountId, code: line.account.code, name: line.account.name, type: line.account.type, debit: 0, credit: 0, balance: 0 };
      current.debit += Number(line.debit);
      current.credit += Number(line.credit);
      current.balance = DEBIT_NORMAL_TYPES.has(line.account.type)
        ? current.debit - current.credit
        : current.credit - current.debit;
      balances.set(line.accountId, current);
    }
    const accountBalances = Array.from(balances.values()).map((account) => ({ ...account, debit: round2(account.debit), credit: round2(account.credit), balance: round2(account.balance) }));
    const revenue = accountBalances.filter((a) => a.type === BusinessAccountType.REVENUE).reduce((sum, a) => sum + a.balance, 0);
    const cogs = accountBalances.filter((a) => a.type === BusinessAccountType.COGS).reduce((sum, a) => sum + a.balance, 0);
    const expenses = accountBalances.filter((a) => a.type === BusinessAccountType.EXPENSE).reduce((sum, a) => sum + a.balance, 0);
    return { revenue: round2(revenue), cogs: round2(cogs), expenses: round2(expenses), grossProfit: round2(revenue - cogs), netProfit: round2(revenue - cogs - expenses), accountBalances };
  },

  async migrateLegacyEntries(userId: string) {
    const legacy = await prisma.businessEntry.findMany({ where: { userId }, orderBy: { date: "asc" } });
    if (!legacy.length) return { businessesCreated: 0, entriesMigrated: 0 };
    const setting = await prisma.setting.findUnique({ where: { userId }, select: { currency: true } });
    const legacyCurrency = setting?.currency ?? "INR";
    const existing = await prisma.businessProfile.findMany({ where: { userId } });
    const byName = new Map(existing.map((business) => [business.name.toLowerCase(), business]));
    let businessesCreated = 0;
    let entriesMigrated = 0;

    for (const entry of legacy) {
      let business = byName.get(entry.businessName.toLowerCase());
      if (!business) {
        business = await this.createBusiness(userId, { name: entry.businessName, legalName: null, type: BusinessType.MIXED, currency: legacyCurrency, fiscalYearStart: 4 });
        byName.set(entry.businessName.toLowerCase(), business as typeof business);
        businessesCreated++;
      }
      const warehouseCount = await prisma.businessWarehouse.count({ where: { businessId: business.id } });
      if (warehouseCount === 0) await prisma.businessWarehouse.create({ data: { businessId: business.id, name: "Main Warehouse", location: null } });
      const accounts = await prisma.businessAccount.findMany({ where: { businessId: business.id } });
      const byCode = new Map(accounts.map((account) => [account.code, account]));
      const reference = `LEGACY-${entry.id}`;
      const alreadyMigrated = await prisma.businessJournalEntry.findFirst({ where: { businessId: business.id, reference } });
      if (alreadyMigrated) continue;
      await assertBusinessPeriodOpen(business.id, entry.date);
      const cash = byCode.get("1000")!;
      const offset = entry.type === BusinessEntryType.INVESTMENT ? byCode.get("3000")! : entry.type === BusinessEntryType.INCOME ? byCode.get("4000")! : byCode.get("6000")!;
      await prisma.$transaction((tx) => createBusinessJournalEntry(tx, {
        businessId: business.id,
        entryDate: entry.date,
        reference,
        description: entry.description || `Migrated ${entry.type.toLowerCase()} entry`,
        lines: entry.type === BusinessEntryType.EXPENSE
          ? [{ accountId: offset.id, debit: entry.amount, credit: 0 }, { accountId: cash.id, debit: 0, credit: entry.amount }]
          : [{ accountId: cash.id, debit: entry.amount, credit: 0 }, { accountId: offset.id, debit: 0, credit: entry.amount }],
      }));
      entriesMigrated++;
    }
    return { businessesCreated, entriesMigrated };
  },
};
