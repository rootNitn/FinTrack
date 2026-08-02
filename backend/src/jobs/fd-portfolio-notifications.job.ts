import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { getFdRateProvider } from "../modules/fd/providers/fd-rate.provider";
import { NotificationPreferenceKey, isNotificationEnabled } from "../utils/notification-preferences";

type FdNotificationType = "FD_MATURITY" | "FD_RATE_CHANGE" | "HIGHER_FD_RATE_AVAILABLE" | "FD_RENEWAL_REMINDER";

const PREFERENCE_KEY: Record<FdNotificationType, NotificationPreferenceKey> = {
  FD_MATURITY: "fdMaturity",
  FD_RATE_CHANGE: "fdRateChange",
  HIGHER_FD_RATE_AVAILABLE: "higherFdRateAvailable",
  FD_RENEWAL_REMINDER: "fdRenewalReminder",
};

async function notifyOnce(userId: string, type: FdNotificationType, title: string, message: string, meta: Record<string, unknown>) {
  if (!(await isNotificationEnabled(userId, PREFERENCE_KEY[type]))) return;

  const metaJson = meta as Prisma.InputJsonObject;
  const existing = await prisma.notification.findFirst({
    where: { userId, type, meta: { equals: metaJson } },
  });
  if (existing) return;
  await prisma.notification.create({ data: { userId, type, title, message, meta: metaJson } });
}

/** 30-day and 7-day maturity reminders + renewal nudge for the new FdPortfolio table. */
async function checkMaturityAndRenewal() {
  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  const maturing = await prisma.fdPortfolio.findMany({
    where: { status: "ACTIVE", maturityDate: { gte: now, lte: in30Days } },
  });

  for (const fd of maturing) {
    const daysLeft = Math.ceil((fd.maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const window = daysLeft <= 7 ? 7 : 30;

    await notifyOnce(
      fd.userId,
      "FD_MATURITY",
      `FD maturing in ${window} days`,
      `Your FD with ${fd.bankName} (₹${Number(fd.amount).toLocaleString("en-IN")}) matures on ${fd.maturityDate.toDateString()}.`,
      { fdPortfolioId: fd.id, window }
    );

    if (daysLeft <= 3) {
      await notifyOnce(
        fd.userId,
        "FD_RENEWAL_REMINDER",
        "Consider renewing your FD",
        `Your FD with ${fd.bankName} matures soon. Check current rates before it auto-matures.`,
        { fdPortfolioId: fd.id }
      );
    }
  }
}

/** Notifies users if a materially higher rate is available elsewhere for a similar tenure than their current FD. */
async function checkHigherRateAvailable() {
  const activeFds = await prisma.fdPortfolio.findMany({ where: { status: "ACTIVE" } });
  if (activeFds.length === 0) return;

  const banks = await getFdRateProvider().getAllBanks(true);

  for (const fd of activeFds) {
    const tenureDays = Math.max(1, Math.round((fd.maturityDate.getTime() - fd.openingDate.getTime()) / (1000 * 60 * 60 * 24)));
    let bestRate = Number(fd.interestRate);
    let bestBankName = fd.bankName;

    for (const bank of banks) {
      const matching = bank.rates.find((r) => tenureDays >= r.tenureMinDays && tenureDays <= r.tenureMaxDays);
      if (matching && matching.interestRate > bestRate) {
        bestRate = matching.interestRate;
        bestBankName = bank.name;
      }
    }

    if (bestRate - Number(fd.interestRate) >= 0.25 && bestBankName !== fd.bankName) {
      await notifyOnce(
        fd.userId,
        "HIGHER_FD_RATE_AVAILABLE",
        "Higher FD rate available",
        `${bestBankName} is offering ${bestRate}% for a similar tenure — higher than your ${fd.bankName} FD at ${Number(fd.interestRate)}%.`,
        { fdPortfolioId: fd.id, bestBankName, bestRate }
      );
    }
  }
}

/** Notifies users holding a favorite/portfolio bank when its rate for a tenure has changed. */
async function checkRateChanges() {
  const recentHistory = await prisma.fdRateHistory.findMany({
    orderBy: { recordedAt: "desc" },
    take: 200,
  });

  const seen = new Set<string>();
  for (const record of recentHistory) {
    const key = `${record.bankId}:${record.tenureLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const previous = await prisma.fdRateHistory.findFirst({
      where: { bankId: record.bankId, tenureLabel: record.tenureLabel, recordedAt: { lt: record.recordedAt } },
      orderBy: { recordedAt: "desc" },
    });
    if (!previous || Number(previous.interestRate) === Number(record.interestRate)) continue;

    const bank = await prisma.fdBank.findUnique({ where: { id: record.bankId } });
    if (!bank) continue;

    const interestedUsers = await prisma.fdFavoriteBank.findMany({ where: { bankId: record.bankId } });
    const portfolioUsers = await prisma.fdPortfolio.findMany({ where: { bankId: record.bankId, status: "ACTIVE" } });
    const userIds = new Set([...interestedUsers.map((u) => u.userId), ...portfolioUsers.map((p) => p.userId)]);

    for (const userId of userIds) {
      await notifyOnce(
        userId,
        "FD_RATE_CHANGE",
        `${bank.name} changed its FD rate`,
        `${bank.name}'s ${record.tenureLabel} rate changed from ${Number(previous.interestRate)}% to ${Number(record.interestRate)}%.`,
        { bankId: record.bankId, tenureLabel: record.tenureLabel, historyId: record.id }
      );
    }
  }
}

export async function runFdPortfolioNotifications() {
  await checkMaturityAndRenewal();
  await checkHigherRateAvailable();
  await checkRateChanges();
  logger.info("FD portfolio notification check completed");
}
