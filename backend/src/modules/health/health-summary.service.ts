import { prisma } from "../../config/prisma";
import { bodyMetricsService } from "./body-metrics.service";
import { dailyLogService } from "./daily-log.service";
import { vitalsService } from "./vitals.service";
import { medicationsService } from "./medications.service";
import { appointmentsService } from "./appointments.service";
import { healthGoalsService } from "./health-goals.service";

export const healthSummaryService = {
  async get(userId: string) {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [
      latestWeight,
      weightHistory,
      today,
      bloodPressureTrend,
      bloodSugarTrend,
      heartRateTrend,
      activeMedications,
      upcomingAppointments,
      goals,
    ] = await Promise.all([
      bodyMetricsService.latest(userId),
      bodyMetricsService.list(userId, 30),
      dailyLogService.getByDate(userId, todayStr),
      vitalsService.list(userId, "BLOOD_PRESSURE", 30),
      vitalsService.list(userId, "BLOOD_SUGAR", 30),
      vitalsService.list(userId, "HEART_RATE", 30),
      medicationsService.list(userId, true),
      appointmentsService.list(userId, true),
      healthGoalsService.list(userId),
    ]);

    const upcomingAppointmentsSoon = upcomingAppointments
      .filter((a) => a.status === "SCHEDULED")
      .slice(0, 5);

    return {
      latestWeight,
      weightTrend: [...weightHistory].reverse(),
      today,
      vitalsTrend: {
        BLOOD_PRESSURE: [...bloodPressureTrend].reverse(),
        BLOOD_SUGAR: [...bloodSugarTrend].reverse(),
        HEART_RATE: [...heartRateTrend].reverse(),
      },
      activeMedications,
      upcomingAppointments: upcomingAppointmentsSoon,
      goals,
      medicationCount: await prisma.medication.count({ where: { userId, active: true } }),
    };
  },
};
