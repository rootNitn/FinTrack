import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { UpdateSettingsInput } from "./settings.dto";

function serializeSettings<T extends Record<string, unknown>>(setting: T) {
  return { ...setting, largeExpenseThreshold: Number(setting.largeExpenseThreshold as Prisma.Decimal) };
}

export const settingsService = {
  async get(userId: string) {
    const setting = await prisma.setting.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return serializeSettings(setting);
  },

  async update(userId: string, input: UpdateSettingsInput) {
    const existing = await prisma.setting.upsert({ where: { userId }, create: { userId }, update: {} });
    const mergedPreferences = {
      ...(existing.notificationPreferences as Record<string, boolean>),
      ...(input.notificationPreferences ?? {}),
    };

    const updated = await prisma.setting.update({
      where: { userId },
      data: {
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.theme ? { theme: input.theme } : {}),
        ...(input.largeExpenseThreshold !== undefined ? { largeExpenseThreshold: input.largeExpenseThreshold } : {}),
        ...(input.dashboardLayout !== undefined ? { dashboardLayout: input.dashboardLayout } : {}),
        notificationPreferences: mergedPreferences,
      },
    });
    return serializeSettings(updated);
  },

  /** Full data export for backup / migration purposes. */
  async exportBackup(userId: string) {
    const [
      user,
      investments,
      transactions,
      expenses,
      incomes,
      goals,
      bankAccounts,
      settings,
      budgets,
      fdPortfolios,
      creditCards,
      creditCardStatements,
      creditCardPayments,
      importHistory,
      familyMembers,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, createdAt: true } }),
      prisma.investment.findMany({ where: { userId } }),
      prisma.transaction.findMany({ where: { userId } }),
      prisma.expense.findMany({ where: { userId } }),
      prisma.income.findMany({ where: { userId } }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.bankAccount.findMany({ where: { userId }, select: { id: true, bankName: true, accountType: true, balance: true, ifsc: true, lastUpdated: true } }),
      prisma.setting.findUnique({ where: { userId } }),
      prisma.budget.findMany({ where: { userId } }),
      prisma.fdPortfolio.findMany({ where: { userId } }),
      // cardNumberEncrypted is intentionally excluded — it's a secret, not user-restorable data.
      prisma.creditCard.findMany({
        where: { userId },
        select: {
          id: true, cardName: true, bankName: true, network: true, cardNumberLast4: true,
          creditLimit: true, currentOutstanding: true, statementDay: true, paymentDueDays: true,
          rewardPointsBalance: true, cashbackBalance: true, annualFee: true, interestRatePercent: true,
          isActive: true, notes: true, familyMemberId: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.creditCardStatement.findMany({ where: { userId } }),
      prisma.creditCardPayment.findMany({ where: { userId } }),
      prisma.importHistory.findMany({ where: { userId } }),
      prisma.familyMember.findMany({ where: { userId } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      user,
      investments,
      transactions,
      expenses,
      incomes,
      goals,
      bankAccounts,
      settings,
      budgets,
      fdPortfolios,
      creditCards,
      creditCardStatements,
      creditCardPayments,
      importHistory,
      familyMembers,
    };
  },

  /**
   * Restore a user's data from a previously exported backup JSON. Wipes the current
   * user's data in these tables and recreates it from the backup, preserving original
   * record ids so internal relations (self-references, FKs) stay intact.
   *
   * Security: every foreign-key reference in the incoming data is validated against the
   * set of ids present IN THE SAME BACKUP before being applied (never against ids already
   * in the DB) — this prevents a crafted backup file from linking a user's restored
   * records to another user's existing rows (IDOR). Unrecognized references are nulled
   * out (or the record is skipped, for required FKs).
   */
  async restoreBackup(userId: string, data: Record<string, any>) {
    const bankAccounts = Array.isArray(data.bankAccounts) ? data.bankAccounts : [];
    const familyMembers = Array.isArray(data.familyMembers) ? data.familyMembers : [];
    const goals = Array.isArray(data.goals) ? data.goals : [];
    const investments = Array.isArray(data.investments) ? data.investments : [];
    const expenses = Array.isArray(data.expenses) ? data.expenses : [];
    const incomes = Array.isArray(data.incomes) ? data.incomes : [];
    const budgets = Array.isArray(data.budgets) ? data.budgets : [];
    const fdPortfolios = Array.isArray(data.fdPortfolios) ? data.fdPortfolios : [];
    const creditCards = Array.isArray(data.creditCards) ? data.creditCards : [];
    const creditCardStatements = Array.isArray(data.creditCardStatements) ? data.creditCardStatements : [];
    const creditCardPayments = Array.isArray(data.creditCardPayments) ? data.creditCardPayments : [];
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    const importHistory = Array.isArray(data.importHistory) ? data.importHistory : [];
    const settings = data.settings && typeof data.settings === "object" ? data.settings : null;

    const bankAccountIds = new Set(bankAccounts.map((b: any) => b.id));
    const familyMemberIds = new Set(familyMembers.map((m: any) => m.id));
    const goalIds = new Set(goals.map((g: any) => g.id));
    const investmentIds = new Set(investments.map((i: any) => i.id));
    const expenseIds = new Set(expenses.map((e: any) => e.id));
    const creditCardIds = new Set(creditCards.map((c: any) => c.id));
    const statementIds = new Set(creditCardStatements.map((s: any) => s.id));

    const ref = (id: unknown, allowed: Set<unknown>) => (id && allowed.has(id) ? (id as string) : null);

    await prisma.$transaction(
      async (tx) => {
        // Delete children before parents.
        await tx.creditCardPayment.deleteMany({ where: { userId } });
        await tx.creditCardStatement.deleteMany({ where: { userId } });
        await tx.creditCard.deleteMany({ where: { userId } });
        await tx.fdPortfolio.deleteMany({ where: { userId } });
        await tx.budget.deleteMany({ where: { userId } });
        await tx.transaction.deleteMany({ where: { userId } });
        await tx.expense.deleteMany({ where: { userId } });
        await tx.income.deleteMany({ where: { userId } });
        await tx.investment.deleteMany({ where: { userId } });
        await tx.goal.deleteMany({ where: { userId } });
        await tx.bankAccount.deleteMany({ where: { userId } });
        await tx.familyMember.deleteMany({ where: { userId } });
        await tx.importHistory.deleteMany({ where: { userId } });

        if (bankAccounts.length) {
          await tx.bankAccount.createMany({
            data: bankAccounts.map((b: any) => ({
              id: b.id,
              userId,
              bankName: b.bankName,
              accountType: b.accountType,
              balance: b.balance,
              ifsc: b.ifsc,
              accountNumberEncrypted: "RESTORED_PLACEHOLDER",
              accountNumberLast4: b.accountNumberLast4 ?? "0000",
              lastUpdated: b.lastUpdated ?? new Date(),
              createdAt: b.createdAt ?? new Date(),
            })),
          });
        }

        if (familyMembers.length) {
          await tx.familyMember.createMany({
            data: familyMembers.map((m: any) => ({
              id: m.id,
              userId,
              name: m.name,
              relation: m.relation ?? null,
              color: m.color ?? null,
              createdAt: m.createdAt ?? new Date(),
              updatedAt: m.updatedAt ?? new Date(),
            })),
          });
        }

        if (goals.length) {
          await tx.goal.createMany({
            data: goals.map((g: any) => ({
              ...g,
              userId,
              familyMemberId: ref(g.familyMemberId, familyMemberIds),
            })),
          });
        }

        if (investments.length) {
          await tx.investment.createMany({
            data: investments.map((i: any) => ({
              ...i,
              userId,
              goalId: ref(i.goalId, goalIds),
              familyMemberId: ref(i.familyMemberId, familyMemberIds),
            })),
          });
        }

        if (expenses.length) {
          await tx.expense.createMany({
            data: expenses.map((e: any) => ({
              ...e,
              userId,
              bankAccountId: ref(e.bankAccountId, bankAccountIds),
              familyMemberId: ref(e.familyMemberId, familyMemberIds),
              parentExpenseId: null,
            })),
          });
          for (const e of expenses) {
            const parentId = ref(e.parentExpenseId, expenseIds);
            if (parentId) {
              await tx.expense.update({ where: { id: e.id }, data: { parentExpenseId: parentId } });
            }
          }
        }

        if (incomes.length) {
          await tx.income.createMany({
            data: incomes.map((i: any) => ({
              ...i,
              userId,
              bankAccountId: ref(i.bankAccountId, bankAccountIds),
            })),
          });
        }

        if (budgets.length) {
          await tx.budget.createMany({
            data: budgets.map((b: any) => ({
              ...b,
              userId,
              familyMemberId: ref(b.familyMemberId, familyMemberIds),
            })),
          });
        }

        if (fdPortfolios.length) {
          await tx.fdPortfolio.createMany({
            data: fdPortfolios.map((f: any) => ({
              ...f,
              userId,
              familyMemberId: ref(f.familyMemberId, familyMemberIds),
            })),
          });
        }

        if (creditCards.length) {
          await tx.creditCard.createMany({
            data: creditCards.map((c: any) => ({
              ...c,
              userId,
              cardNumberEncrypted: "RESTORED_PLACEHOLDER",
              familyMemberId: ref(c.familyMemberId, familyMemberIds),
            })),
          });
        }

        if (creditCardStatements.length) {
          const valid = creditCardStatements.filter((s: any) => creditCardIds.has(s.cardId));
          if (valid.length) {
            await tx.creditCardStatement.createMany({
              data: valid.map((s: any) => ({ ...s, userId })),
            });
          }
        }

        if (creditCardPayments.length) {
          const valid = creditCardPayments.filter((p: any) => creditCardIds.has(p.cardId));
          if (valid.length) {
            await tx.creditCardPayment.createMany({
              data: valid.map((p: any) => ({
                ...p,
                userId,
                statementId: ref(p.statementId, statementIds),
              })),
            });
          }
        }

        if (transactions.length) {
          await tx.transaction.createMany({
            data: transactions.map((t: any) => ({
              ...t,
              userId,
              relatedInvestmentId: ref(t.relatedInvestmentId, investmentIds),
              bankAccountId: ref(t.bankAccountId, bankAccountIds),
            })),
          });
        }

        if (importHistory.length) {
          await tx.importHistory.createMany({
            data: importHistory.map((h: any) => ({ ...h, userId })),
          });
        }

        if (settings) {
          const { id: _id, userId: _uid, ...rest } = settings;
          await tx.setting.upsert({
            where: { userId },
            create: { ...rest, userId },
            update: { ...rest },
          });
        }
      },
      { timeout: 30000 },
    );

    return { message: "Backup restored successfully." };
  },
};
