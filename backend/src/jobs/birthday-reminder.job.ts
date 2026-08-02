import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { isNotificationEnabled } from "../utils/notification-preferences";

/**
 * Notifies users on their birthday (based on the optional dateOfBirth profile field).
 * Dedupes once per calendar year via meta.year.
 */
export async function runBirthdayReminderCheck() {
  const today = new Date();
  const users = await prisma.user.findMany({
    where: { dateOfBirth: { not: null }, isActive: true },
    select: { id: true, name: true, dateOfBirth: true },
  });

  let created = 0;
  for (const user of users) {
    if (!user.dateOfBirth) continue;
    if (user.dateOfBirth.getMonth() !== today.getMonth() || user.dateOfBirth.getDate() !== today.getDate()) continue;
    if (!(await isNotificationEnabled(user.id, "birthdayReminder"))) continue;

    const metaJson = { year: today.getFullYear() } as Prisma.InputJsonObject;
    const existing = await prisma.notification.findFirst({
      where: { userId: user.id, type: "BIRTHDAY_REMINDER", meta: { equals: metaJson } },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "BIRTHDAY_REMINDER",
        title: "Happy Birthday! 🎂",
        message: `Happy Birthday, ${user.name}! Wishing you a great year ahead.`,
        meta: metaJson,
      },
    });
    created += 1;
  }

  logger.info({ created }, "Birthday reminder check completed");
}
