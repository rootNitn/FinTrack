import { z } from "zod";

export const aiReportImproveRequestSchema = z.object({
  reportType: z.enum(["monthly", "quarterly", "yearly", "investment", "expense", "goal"]),
  month: z.number().min(1).max(12).optional(),
  quarter: z.number().min(1).max(4).optional(),
  year: z.number().min(2000).max(2100).optional(),
});

export type AiReportImproveRequest = z.infer<typeof aiReportImproveRequestSchema>;

export interface AiImprovement {
  title: string;
  category: "FINANCE" | "HEALTH" | "TIME";
  priority: "HIGH" | "MEDIUM" | "LOW";
  whyItMatters: string;
  currentSituation: string;
  recommendedAction: string;
  expectedBenefit: string;
  supportingDataLink?: string;
  actionLink?: string;
}

export interface AiReportImproveResponse {
  overallScore: number;
  summary: string;
  topImprovements: AiImprovement[];
  financialImprovements: AiImprovement[];
  healthImprovements: AiImprovement[];
  timeImprovements: AiImprovement[];
  thirtyDayPlan: {
    week1: string[];
    week2: string[];
    week3: string[];
    week4: string[];
  };
  finalRecommendation: string;
}
