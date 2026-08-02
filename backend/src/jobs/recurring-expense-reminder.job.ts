import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { NotificationPreferenceKey, isNotificationEnabled } from "../utils/notification-preferences";

const REMINDER_WINDOW_DAYS = 3;

type RecurringNotificationType = "EMI_DUE" | "INSURANCE_RENEWAL";

const PREFERENCE_KEY: Record<RecurringNotificationType, NotificationPreferenceKey> = {
  EMI_DUE: "emiDue",
  INSURANCE_RENEWAL: "insuranceRenewal",
};

async function notifyOnce(
  userId: string,
  type: RecurringNotificationType,
  title: string,
  message: string,
  meta: Record<string, unknown>,
) {
  if (!(await isNotificationEnabled(userId, PREFERENCE_KEY[type]))) return;

  const metaJson = meta as Prisma.InputJsonObject;
  const existing = await prisma.notification.findFirst({
    where: { userId, type, meta: { equals: metaJson } },
  });
  if (existing) return;
  await prisma.notification.create({ data: { userId, type, title, message, meta: metaJson } });
}

/**
 * Reminds users a few days before a recurring EMI or insurance-premium expense is next due.
 * Dedupes per occurrence via the exact due date stored in the notification's meta, so the
 * reminder naturally re-fires once the template advances to its next cycle.
 */
export async function runRecurringExpenseReminderCheck() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const templates = await prisma.expense.findMany({
    where: { isRecurring: true, category: { in: ["EMI", "INSURANCE"] }, nextRecurrenceDate: { not: null } },
  });

  let created = 0;
  for (const template of templates) {
    const dueDate = template.nextRecurrenceDate;
    if (!dueDate) continue;

    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue < 0 || daysUntilDue > REMINDER_WINDOW_DAYS) continue;

    const dueDateKey = dueDate.toISOString().slice(0, 10);
    const amount = Number(template.amount).toFixed(2);
    const meta = { expenseId: template.id, dueDate: dueDateKey };

    if (template.category === "EMI") {
      await notifyOnce(
        template.userId,
        "EMI_DUE",
        "EMI due soon",
        `Your EMI of ${amount} for "${template.description ?? "an expense"}" is due on ${dueDate.toDateString()}.`,
        meta,
      );
    } else {
      await notifyOnce(
        template.userId,
        "INSURANCE_RENEWAL",
        "Insurance premium due soon",
        `Your insurance premium of ${amount} for "${template.description ?? "a policy"}" is due on ${dueDate.toDateString()}.`,
        meta,
      );
    }
    created += 1;
  }

  logger.info({ created }, "Recurring expense reminder check completed");
}
