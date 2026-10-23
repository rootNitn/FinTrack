import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createMedicationSchema = z.object({
  name: z.string().min(1, "Medication name is required").max(150),
  dosage: z.string().max(100).optional(),
  scheduleTimes: z.array(z.string().regex(timeRegex, "times must be in HH:mm format")).default([]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  active: z.boolean().default(true),
  reminderEnabled: z.boolean().default(true),
  notes: z.string().max(500).optional(),
});

export const updateMedicationSchema = createMedicationSchema.partial();

export const logMedicationSchema = z.object({
  status: z.enum(["TAKEN", "MISSED", "SKIPPED"]),
  scheduledFor: z.coerce.date(),
});

export type CreateMedicationInput = z.infer<typeof createMedicationSchema>;
export type UpdateMedicationInput = z.infer<typeof updateMedicationSchema>;
export type LogMedicationInput = z.infer<typeof logMedicationSchema>;
