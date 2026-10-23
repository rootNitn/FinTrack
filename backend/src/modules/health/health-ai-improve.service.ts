import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import {
  HealthAiImproveRequest,
  HealthAiImproveResponse,
  healthAiImproveResponse,
  SaveHealthWellnessPlanRequest,
} from "./health-ai-improve.dto";

export class HealthAiImproveService {
  async improve(
    userId: string,
    request: HealthAiImproveRequest
  ): Promise<HealthAiImproveResponse> {
    // Build context from user's health data
    const context = await this.buildHealthContext(userId, request.reportId);

    // Call Groq API with health-focused prompt
    const aiResponse = await this.callGroqApi(context, request.focusArea);

    // Parse and validate the response
    const parsed = this.parseAndValidate(aiResponse);

    return parsed;
  }

  async savePlan(userId: string, request: SaveHealthWellnessPlanRequest) {
    if (request.reportId) {
      const report = await prisma.healthReportDocument.findFirst({
        where: { id: request.reportId, userId },
        select: { id: true },
      });
      if (!report) throw AppError.notFound("Health report not found");
    }

    return prisma.healthWellnessPlan.create({
      data: {
        userId,
        reportId: request.reportId,
        focusArea: request.focusArea,
        content: request.content,
      },
    });
  }

  async listPlans(userId: string) {
    return prisma.healthWellnessPlan.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getPlan(userId: string, id: string) {
    const plan = await prisma.healthWellnessPlan.findFirst({ where: { id, userId } });
    if (!plan) throw AppError.notFound("Wellness plan not found");
    return plan;
  }

  /** Returns the most recently saved plan for a given report, if one exists. */
  async getPlanForReport(userId: string, reportId: string) {
    return prisma.healthWellnessPlan.findFirst({
      where: { userId, reportId },
      orderBy: { createdAt: "desc" },
    });
  }

  async deletePlan(userId: string, id: string) {
    const plan = await prisma.healthWellnessPlan.findFirst({ where: { id, userId } });
    if (!plan) throw AppError.notFound("Wellness plan not found");
    await prisma.healthWellnessPlan.delete({ where: { id } });
  }

  /** Re-runs the AI generation for an already-saved plan and overwrites its content in place. */
  async regeneratePlan(userId: string, id: string) {
    const existing = await prisma.healthWellnessPlan.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Wellness plan not found");

    const content = await this.improve(userId, {
      reportId: existing.reportId ?? undefined,
      focusArea: (existing.focusArea as HealthAiImproveRequest["focusArea"]) ?? undefined,
    });

    return prisma.healthWellnessPlan.update({
      where: { id },
      data: { content },
    });
  }

  private async buildHealthContext(userId: string, reportId?: string): Promise<string> {
    let context = "User's Health Data:\n\n";

    // Fetch body metrics
    const bodyMetrics = await prisma.bodyMetricLog.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      take: 5,
    });
    if (bodyMetrics.length > 0) {
      context += "=== Body Metrics ===\n";
      const latest = bodyMetrics[0];
      context += `- Height: ${latest.heightCm} cm\n`;
      context += `- Weight: ${latest.weightKg} kg\n`;
      if (latest.bodyFatPercent) context += `- Body Fat: ${latest.bodyFatPercent}%\n`;
      if (latest.waistCm) context += `- Waist: ${latest.waistCm} cm\n`;
      context += "\n";
    }

    // Fetch vitals
    const latestVitals = await prisma.vitalLog.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      take: 10,
    });
    if (latestVitals.length > 0) {
      context += "=== Recent Vitals ===\n";
      latestVitals.forEach((v: any) => {
        context += `- ${v.type}: ${v.value} (${v.recordedAt.toLocaleDateString()})\n`;
      });
      context += "\n";
    }

    // Fetch workouts
    const workouts = await prisma.workoutLog.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 7,
    });
    if (workouts.length > 0) {
      context += "=== Recent Workouts ===\n";
      workouts.forEach((w: any) => {
        context += `- ${w.type}: ${w.durationMinutes} min (${w.caloriesBurned || 0} cal) on ${w.date.toLocaleDateString()}\n`;
      });
      context += "\n";
    }

    // Fetch daily wellness logs
    const dailyLogs = await prisma.dailyWellnessLog.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 7,
    });
    if (dailyLogs.length > 0) {
      context += "=== Daily Wellness (Last 7 days) ===\n";
      dailyLogs.forEach((log: any) => {
        context += `- ${log.date.toLocaleDateString()}: ${log.waterIntakeLiters}L water, ${log.sleepHours}h sleep, ${log.steps} steps\n`;
      });
      context += "\n";
    }

    // Fetch medications
    const medications = await prisma.medication.findMany({
      where: { userId, active: true },
    });
    if (medications.length > 0) {
      context += "=== Active Medications ===\n";
      medications.forEach((m: any) => {
        context += `- ${m.name}: ${m.dosage} (${m.schedule?.join(", ") || "unknown schedule"})\n`;
      });
      context += "\n";
    }

    // Fetch health goals
    const healthGoals = await prisma.healthGoal.findMany({
      where: { userId },
    });
    if (healthGoals.length > 0) {
      context += "=== Health Goals ===\n";
      healthGoals.forEach((g: any) => {
        context += `- ${g.name}: Target ${g.targetValue}, Current ${g.currentValue} (${Math.round((Math.min(g.currentValue, g.targetValue) / Math.max(g.currentValue, g.targetValue)) * 100)}% progress)\n`;
      });
      context += "\n";
    }

    // Fetch latest health report if specified
    if (reportId) {
      const healthReport = await prisma.healthReportDocument.findUnique({
        where: { id: reportId },
        include: { results: true },
      });
      if (healthReport) {
        context += "=== Latest Health Report ===\n";
        context += `Report Date: ${healthReport.reportDate.toLocaleDateString()}\n`;
        healthReport.results.forEach((r: any) => {
          context += `- ${r.testName}: ${r.value} ${r.unit} (${r.status})\n`;
        });
      }
    }

    return context;
  }

  private async callGroqApi(
    context: string,
    focusArea?: string
  ): Promise<string> {
    const focusAreaText =
      focusArea === "DIET"
        ? "focus on diet and nutrition recommendations"
        : focusArea === "WORKOUT"
        ? "focus on exercise and workout recommendations"
        : focusArea === "SLEEP"
        ? "focus on sleep improvement recommendations"
        : focusArea === "STRESS"
        ? "focus on stress management recommendations"
        : "provide overall wellness recommendations";

    const systemPrompt = `You are a professional health and wellness advisor. Analyze the user's health data and provide personalized recommendations.

IMPORTANT: You MUST respond with ONLY valid JSON that matches this exact structure (no markdown, no extra text):
{
  "overallWellnessScore": number (0-100),
  "summary": "string",
  "keyFindings": ["string", "string"],
  "improvements": [
    {
      "title": "string",
      "category": "DIET" | "EXERCISE" | "SLEEP" | "STRESS" | "HYDRATION" | "NUTRITION",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "currentSituation": "string",
      "recommendation": "string",
      "expectedBenefit": "string"
    }
  ],
  "dailySchedule": [
    {
      "time": "HH:mm",
      "activity": "string",
      "duration": "string (e.g., '30 mins', '1 hour')",
      "notes": "string"
    }
  ],
  "mealPlan": [
    {
      "meal": "BREAKFAST" | "LUNCH" | "DINNER" | "SNACKS",
      "items": ["string"],
      "hydration": "string"
    }
  ],
  "weeklyGoals": ["string"],
  "finalRecommendation": "string"
}

Please ${focusAreaText} while creating a practical wellness plan based on the provided health data.`;

    const userPrompt = `Here is the user's health data:\n\n${context}\n\nBased on this data, create a comprehensive wellness improvement plan. Be specific and actionable.`;

    if (!env.GROQ_API_KEY) {
      throw AppError.internal("Groq API key not configured");
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw AppError.internal(`Groq API error: ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  private parseAndValidate(responseText: string): HealthAiImproveResponse {
    let cleanedText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    try {
      const parsed = JSON.parse(cleanedText);

      // Validate against schema
      const validated = healthAiImproveResponse.parse(parsed);
      return validated;
    } catch (error) {
      console.error("Failed to parse health AI response:", {
        originalText: responseText.substring(0, 500),
        cleanedText: cleanedText.substring(0, 500),
        error: error instanceof Error ? error.message : String(error),
      });
      // Return a fallback response
      return {
        overallWellnessScore: 50,
        summary: "Unable to generate recommendations at this time",
        keyFindings: [],
        improvements: [],
        dailySchedule: [],
        mealPlan: [],
        weeklyGoals: [],
        finalRecommendation: "Please try again later",
      };
    }
  }
}

export const healthAiImproveService = new HealthAiImproveService();
