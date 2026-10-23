import { z } from "zod";

export const createBodyMetricSchema = z.object({
  weightKg: z.coerce.number().positive(),
  heightCm: z.coerce.number().positive().optional(),
  bodyFatPercent: z.coerce.number().min(0).max(100).optional(),
  waistCm: z.coerce.number().positive().optional(),
  notes: z.string().max(500).optional(),
  recordedAt: z.coerce.date().optional(),
});

export const updateBodyMetricSchema = createBodyMetricSchema.partial();

export type CreateBodyMetricInput = z.infer<typeof createBodyMetricSchema>;
export type UpdateBodyMetricInput = z.infer<typeof updateBodyMetricSchema>;
