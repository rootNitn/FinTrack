import { z } from "zod";
import { HealthGoalType } from "@prisma/client";

export const healthGoalTypeEnum = z.nativeEnum(HealthGoalType);

export const createHealthGoalSchema = z.object({
  type: healthGoalTypeEnum,
  targetValue: z.coerce.number().positive(),
  deadline: z.coerce.date().nullable().optional(),
});

export const updateHealthGoalSchema = z.object({
  targetValue: z.coerce.number().positive().optional(),
  deadline: z.coerce.date().nullable().optional(),
});

export type CreateHealthGoalInput = z.infer<typeof createHealthGoalSchema>;
export type UpdateHealthGoalInput = z.infer<typeof updateHealthGoalSchema>;
