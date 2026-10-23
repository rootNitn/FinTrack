import { z } from "zod";

export const healthAiImproveRequestSchema = z.object({
  reportId: z.string().optional(),
  focusArea: z.enum(["DIET", "WORKOUT", "SLEEP", "STRESS", "OVERALL"]).optional(),
});

export const dailyScheduleItem = z.object({
  time: z.string(), // HH:mm format
  activity: z.string(),
  duration: z.string(), // e.g., "30 mins"
  notes: z.string().optional(),
});

export const healthImprovement = z.object({
  title: z.string(),
  category: z.enum(["DIET", "EXERCISE", "SLEEP", "STRESS", "HYDRATION", "NUTRITION"]),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  currentSituation: z.string(),
  recommendation: z.string(),
  expectedBenefit: z.string(),
});

export const healthAiImproveResponse = z
  .object({
    overallWellnessScore: z.number().min(0).max(100),
    summary: z.string(),
    keyFindings: z.array(z.string()),
    improvements: z.array(healthImprovement),
    dailySchedule: z.array(dailyScheduleItem),
    mealPlan: z.array(
      z.object({
        meal: z.string(), // BREAKFAST, LUNCH, DINNER, SNACKS
        items: z.array(z.string()),
        hydration: z.string().optional(),
      })
    ),
    weeklyGoals: z.array(z.string()),
    finalRecommendation: z.string(),
  })
  .strict(); // Reject any extra fields

export type HealthAiImproveRequest = z.infer<typeof healthAiImproveRequestSchema>;
export type HealthAiImproveResponse = z.infer<typeof healthAiImproveResponse>;
export type DailyScheduleItem = z.infer<typeof dailyScheduleItem>;
export type HealthImprovement = z.infer<typeof healthImprovement>;

export const saveHealthWellnessPlanSchema = z.object({
  reportId: z.string().optional(),
  focusArea: z.enum(["DIET", "WORKOUT", "SLEEP", "STRESS", "OVERALL"]).optional(),
  content: healthAiImproveResponse,
});

export type SaveHealthWellnessPlanRequest = z.infer<typeof saveHealthWellnessPlanSchema>;
