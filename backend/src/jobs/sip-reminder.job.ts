import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { isNotificationEnabled } from "../utils/notification-preferences";

/**
 * For active investments with a recurring SIP, reminds the user a few days before the
 * SIP due date (assumed to recur monthly on the same day-of-month as the purchase date).
 */
export async function runSipReminderCheck() {
  const today = new Date();
  const investments = await prisma.investment.findMany({
    where: { status: "ACTIVE", sipAmount: { not: null, gt: 0 } },
  });

  let created = 0;
  for (const investment of investments) {
    const dueDay = investment.purchaseDate.getDate();
    const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0 || daysUntilDue > 3) continue;
    if (!(await isNotificationEnabled(investment.userId, "sipReminder"))) continue;

    const monthKey = `${today.getFullYear()}-${today.getMonth() + 1}`;
    const existing = await prisma.notification.findFirst({
      where: {
        userId: investment.userId,
        type: "SIP_REMINDER",
        meta: { path: ["investmentId"], equals: investment.id },
        createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) },
      },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        userId: investment.userId,
        type: "SIP_REMINDER",
        title: "SIP due soon",
        message: `Your SIP of ${Number(investment.sipAmount).toFixed(2)} for "${investment.name}" is due on ${dueDate.toDateString()}.`,
        meta: { investmentId: investment.id, monthKey },
      },
    });
    created += 1;
  }

  logger.info({ created }, "SIP reminder check completed");
}
