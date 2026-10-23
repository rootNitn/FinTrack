import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { isNotificationEnabled } from "../utils/notification-preferences";

/**
 * Notifies about upcoming SCHEDULED doctor appointments within the next 3 days.
 * Dedup key: meta.appointmentId (fires once per appointment, not once per day-of-window).
 */
export async function runAppointmentReminderCheck() {
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 3);

  const appointments = await prisma.doctorAppointment.findMany({
    where: {
      status: "SCHEDULED",
      reminderEnabled: true,
      appointmentDate: { gte: now, lte: windowEnd },
    },
  });

  let created = 0;
  for (const appointment of appointments) {
    if (!(await isNotificationEnabled(appointment.userId, "appointmentReminder"))) continue;

    const metaJson = { appointmentId: appointment.id } as Prisma.InputJsonObject;
    const existing = await prisma.notification.findFirst({
      where: { userId: appointment.userId, type: "APPOINTMENT_REMINDER", meta: { equals: metaJson } },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        userId: appointment.userId,
        type: "APPOINTMENT_REMINDER",
        title: "Upcoming doctor appointment",
        message: `Appointment with Dr. ${appointment.doctorName} on ${appointment.appointmentDate.toDateString()}.`,
        meta: metaJson,
      },
    });
    created += 1;
  }

  logger.info({ created }, "Appointment reminder check completed");
}
