import { z } from "zod";
import { GoalType } from "@prisma/client";

export const goalTypeEnum = z.nativeEnum(GoalType);

export const createGoalSchema = z.object({
  name: z.string().min(1, "Goal name is required").max(150),
  type: goalTypeEnum,
  targetAmount: z.coerce.number().positive("Target amount must be greater than 0"),
  currentAmount: z.coerce.number().nonnegative().default(0),
  deadline: z.coerce.date(),
  icon: z.string().max(50).optional(),
  // Assumed annual return for the required-monthly-SIP projection — omit/0 for a plain linear split (no growth assumed).
  expectedReturnPercent: z.coerce.number().min(0).max(100).nullable().optional(),
  familyMemberId: z.string().uuid().nullable().optional(),
});

export const updateGoalSchema = createGoalSchema.partial();

export const addGoalContributionSchema = z.object({
  amount: z.coerce.number().positive("Contribution amount must be greater than 0"),
  date: z.coerce.date().max(new Date(), "Contribution date cannot be in the future").optional(),
  note: z.string().max(250).optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
