import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { CC_DUE_SOON_DAYS } from "../modules/credit-cards/credit-cards.constants";
import { daysUntil } from "../modules/credit-cards/credit-cards.util";
import { isNotificationEnabled } from "../utils/notification-preferences";

/**
 * Scans unpaid/partially-paid credit card statements due within the next
 * {@link CC_DUE_SOON_DAYS} days (or already overdue), flips overdue statements to the
 * OVERDUE status, and creates a CC_PAYMENT_DUE notification (once per statement) if one
 * doesn't already exist.
 */
export async function runCreditCardDueReminderCheck() {
  const dueSoonBy = new Date();
  dueSoonBy.setDate(dueSoonBy.getDate() + CC_DUE_SOON_DAYS);

  const statements = await prisma.creditCardStatement.findMany({
    where: {
      status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
      dueDate: { lte: dueSoonBy },
    },
    include: { card: true },
  });

  let notified = 0;
  for (const statement of statements) {
    const overdue = daysUntil(statement.dueDate) < 0;
    if (overdue && statement.status !== "OVERDUE") {
      await prisma.creditCardStatement.update({ where: { id: statement.id }, data: { status: "OVERDUE" } });
    }

    const existing = await prisma.notification.findFirst({
      where: { userId: statement.userId, type: "CC_PAYMENT_DUE", meta: { path: ["statementId"], equals: statement.id } },
    });
    if (existing) continue;
    if (!(await isNotificationEnabled(statement.userId, "ccPaymentDue"))) continue;

    const remainingDue = Number(statement.totalDue) - Number(statement.paidAmount);
    await prisma.notification.create({
      data: {
        userId: statement.userId,
        type: "CC_PAYMENT_DUE",
        title: overdue ? "Credit card payment overdue" : "Credit card payment due soon",
        message: `"${statement.card.cardName}" has ₹${remainingDue.toFixed(2)} due on ${statement.dueDate.toDateString()}.`,
        meta: { statementId: statement.id, cardId: statement.cardId },
      },
    });
    notified++;
  }

  logger.info({ scanned: statements.length, notified }, "Credit card due reminder check completed");
}
