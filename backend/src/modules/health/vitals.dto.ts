import { z } from "zod";
import { VitalType } from "@prisma/client";

export const vitalTypeEnum = z.nativeEnum(VitalType);

export const createVitalSchema = z
  .object({
    type: vitalTypeEnum,
    systolic: z.coerce.number().int().positive().optional(),
    diastolic: z.coerce.number().int().positive().optional(),
    value: z.coerce.number().positive().optional(),
    unit: z.string().max(20).optional(),
    context: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
    recordedAt: z.coerce.date().optional(),
  })
  .refine((data) => (data.type === "BLOOD_PRESSURE" ? data.systolic != null && data.diastolic != null : data.value != null), {
    message: "Blood pressure requires systolic & diastolic; other vitals require a value",
  });

export const updateVitalSchema = z.object({
  systolic: z.coerce.number().int().positive().optional(),
  diastolic: z.coerce.number().int().positive().optional(),
  value: z.coerce.number().positive().optional(),
  unit: z.string().max(20).optional(),
  context: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  recordedAt: z.coerce.date().optional(),
});

export const vitalQuerySchema = z.object({
  type: vitalTypeEnum.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export type CreateVitalInput = z.infer<typeof createVitalSchema>;
export type UpdateVitalInput = z.infer<typeof updateVitalSchema>;
