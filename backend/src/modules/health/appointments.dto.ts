import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";

export const appointmentStatusEnum = z.nativeEnum(AppointmentStatus);

export const createAppointmentSchema = z.object({
  doctorName: z.string().min(1, "Doctor name is required").max(150),
  specialty: z.string().max(100).optional(),
  appointmentDate: z.coerce.date(),
  location: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  status: appointmentStatusEnum.default("SCHEDULED"),
  reminderEnabled: z.boolean().default(true),
});

export const updateAppointmentSchema = createAppointmentSchema.partial();

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
