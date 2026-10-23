import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { isNotificationEnabled } from "../utils/notification-preferences";

const REMINDER_WINDOW_DAYS = 30;

/**
 * Reminds users when an insurance policy's renewal is approaching — complements
 * recurring-expense-reminder.job.ts (which only fires for a policy premium ALSO logged as a
 * recurring INSURANCE-category expense). This one reads the InsurancePolicy record directly, so
 * it works even for policies with no linked recurring expense. Uses `renewalDate` if the user set
 * one (more precise), falling back to `expiryDate` otherwise. Dedupe key is {policyId, dueDate},
 * so it naturally re-fires once the policy is renewed to a new date.
 */
export async function runInsuranceRenewalCheck() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + REMINDER_WINDOW_DAYS);

  const policies = await prisma.insurancePolicy.findMany({
    where: { OR: [{ renewalDate: { not: null } }, { expiryDate: { not: null } }] },
  });

  let created = 0;
  for (const policy of policies) {
    const dueDate = policy.renewalDate ?? policy.expiryDate;
    if (!dueDate || dueDate < today || dueDate > windowEnd) continue;
    if (!(await isNotificationEnabled(policy.userId, "insuranceRenewal"))) continue;

    const dueDateKey = dueDate.toISOString().slice(0, 10);
    const meta = { policyId: policy.id, dueDate: dueDateKey } as Prisma.InputJsonObject;

    const existing = await prisma.notification.findFirst({
      where: { userId: policy.userId, type: "INSURANCE_RENEWAL", meta: { equals: meta } },
    });
    if (existing) continue;

    const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const label = policy.provider ? `${policy.provider} (${policy.type})` : `your ${policy.type.toLowerCase()} policy`;
    await prisma.notification.create({
      data: {
        userId: policy.userId,
        type: "INSURANCE_RENEWAL",
        title: "Insurance policy expiring soon",
        message: `${label} is due for renewal on ${dueDate.toDateString()} (in ${daysLeft} day${daysLeft === 1 ? "" : "s"}) — renew it to keep your coverage active.`,
        meta,
      },
    });
    created += 1;
  }

  logger.info({ created }, "Insurance renewal check completed");
}
