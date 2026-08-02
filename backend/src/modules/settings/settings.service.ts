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
          isActive: true, notes: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.creditCardStatement.findMany({ where: { userId } }),
      prisma.creditCardPayment.findMany({ where: { userId } }),
      prisma.importHistory.findMany({ where: { userId } }),
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
    };
  },
};
