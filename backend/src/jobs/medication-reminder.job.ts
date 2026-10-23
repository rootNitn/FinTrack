import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { isNotificationEnabled } from "../utils/notification-preferences";

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Fires MEDICATION_REMINDER notifications for active medications whose scheduleTimes include a
 * time within the current 10-minute tick (this job is registered to run every 10 minutes).
 * Dedup key: {medicationId, date, time} so re-runs within the same tick don't double-notify.
 */
export async function runMedicationReminderCheck() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nowMinutes = minutesSinceMidnight(now);

  const medications = await prisma.medication.findMany({
    where: {
      active: true,
      reminderEnabled: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
  });

  let created = 0;
  for (const medication of medications) {
    const times = (medication.scheduleTimes as string[] | null) ?? [];
    const dueTime = times.find((t) => Math.abs(timeToMinutes(t) - nowMinutes) < 5);
    if (!dueTime) continue;

    if (!(await isNotificationEnabled(medication.userId, "medicationReminder"))) continue;

    const alreadyNotified = await prisma.notification.findFirst({
      where: {
        userId: medication.userId,
        type: "MEDICATION_REMINDER",
        AND: [
          { meta: { path: ["medicationId"], equals: medication.id } },
          { meta: { path: ["date"], equals: todayStr } },
          { meta: { path: ["time"], equals: dueTime } },
        ],
      },
    });
    if (alreadyNotified) continue;

    await prisma.notification.create({
      data: {
        userId: medication.userId,
        type: "MEDICATION_REMINDER",
        title: "Medication reminder",
        message: `Time to take ${medication.name}${medication.dosage ? ` (${medication.dosage})` : ""}.`,
        meta: { medicationId: medication.id, date: todayStr, time: dueTime },
      },
    });
    created += 1;
  }

  logger.info({ created }, "Medication reminder check completed");
}
