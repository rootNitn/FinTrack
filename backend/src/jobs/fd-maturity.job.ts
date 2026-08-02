import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { isNotificationEnabled } from "../utils/notification-preferences";

/**
 * Scans FIXED_DEPOSIT / BONDS investments maturing within the next 7 days and creates
 * an FD_MATURITY notification (once per investment) if one doesn't already exist.
 */
export async function runFdMaturityCheck() {
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);

  const maturingInvestments = await prisma.investment.findMany({
    where: {
      status: "ACTIVE",
      category: { in: ["FIXED_DEPOSIT", "BONDS"] },
      maturityDate: { not: null, lte: in7Days, gte: new Date() },
    },
  });

  for (const investment of maturingInvestments) {
    if (!(await isNotificationEnabled(investment.userId, "fdMaturity"))) continue;

    const existing = await prisma.notification.findFirst({
      where: { userId: investment.userId, type: "FD_MATURITY", meta: { path: ["investmentId"], equals: investment.id } },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        userId: investment.userId,
        type: "FD_MATURITY",
        title: "Upcoming maturity",
        message: `"${investment.name}" matures on ${investment.maturityDate?.toDateString()}.`,
        meta: { investmentId: investment.id },
      },
    });
  }

  logger.info({ count: maturingInvestments.length }, "FD maturity check completed");
}
