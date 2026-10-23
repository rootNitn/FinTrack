import { z } from "zod";
import { WorkoutType } from "@prisma/client";

export const workoutTypeEnum = z.nativeEnum(WorkoutType);

export const createWorkoutSchema = z.object({
  type: workoutTypeEnum,
  name: z.string().max(150).optional(),
  durationMinutes: z.coerce.number().int().positive(),
  caloriesBurned: z.coerce.number().int().nonnegative().optional(),
  distanceKm: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  date: z.coerce.date().optional(),
});

export const updateWorkoutSchema = createWorkoutSchema.partial();

export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;
export type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>;
