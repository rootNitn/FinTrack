import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateAppointmentInput, UpdateAppointmentInput } from "./appointments.dto";

export const appointmentsService = {
  async list(userId: string, upcomingOnly = false) {
    return prisma.doctorAppointment.findMany({
      where: { userId, ...(upcomingOnly ? { appointmentDate: { gte: new Date() } } : {}) },
      orderBy: { appointmentDate: "asc" },
    });
  },

  async getById(userId: string, id: string) {
    const appointment = await prisma.doctorAppointment.findFirst({ where: { id, userId } });
    if (!appointment) throw AppError.notFound("Appointment not found");
    return appointment;
  },

  async create(userId: string, input: CreateAppointmentInput) {
    return prisma.doctorAppointment.create({ data: { ...input, userId } });
  },

  async update(userId: string, id: string, input: UpdateAppointmentInput) {
    const existing = await prisma.doctorAppointment.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Appointment not found");
    return prisma.doctorAppointment.update({ where: { id }, data: input });
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.doctorAppointment.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Appointment not found");
    await prisma.doctorAppointment.delete({ where: { id } });
  },
};
