import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { prisma } from "../../config/prisma";
import { aiInsightsService } from "../ai-insights/ai-insights.service";
import { financialHealthService } from "../financial-health/financial-health.service";
import { reportsService } from "../reports/reports.service";
import { AiReportImproveRequest, AiReportImproveResponse } from "./ai-report.dto";
import { ReportQuery } from "../reports/reports.dto";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are a personal financial and wellness improvement assistant.

Analyze ONLY the data provided to you.

If any section of the data snapshot is null or unavailable, explicitly say that the recommendation is limited by missing data. Never infer or invent values.

Identify the most important opportunities for improvement in the user's financial health and, when health data is provided, general wellness.

Do not invent data.

Prioritize recommendations using:
1. Impact
2. Urgency
3. Ease of implementation

Give specific, practical actions instead of generic advice.

For financial recommendations, consider:
- Spending
- Saving
- Emergency fund
- Debt
- Investments
- Diversification
- Asset allocation
- Insurance
- Taxes
- Retirement
- Financial goals

For wellness recommendations, consider:
- Sleep
- Exercise
- Hydration
- Steps/activity
- Wellness goals
- Recorded trends

Do not diagnose medical conditions or provide medical treatment.
If a health issue appears potentially concerning, recommend discussing it with a qualified healthcare professional.

Return ONLY valid JSON using this exact structure (no markdown, no extra text):

{
  "overallScore": 0,
  "summary": "Short personalized summary",
  "topImprovements": [
    {
      "title": "Improvement title",
      "category": "FINANCE | HEALTH | TIME",
      "priority": "HIGH | MEDIUM | LOW",
      "whyItMatters": "Why this matters",
      "currentSituation": "What the user's data shows",
      "recommendedAction": "Specific action",
      "expectedBenefit": "Expected benefit"
      ,"supportingDataLink": "/expenses"
      ,"actionLink": "/goals"
    }
  ],
  "financialImprovements": [],
  "healthImprovements": [],
  "timeImprovements": [],
  "thirtyDayPlan": {
    "week1": [],
    "week2": [],
    "week3": [],
    "week4": []
  },
  "finalRecommendation": "The single most important action"
}

User's data snapshot (JSON):
`;

async function buildReportContext(userId: string, request: AiReportImproveRequest): Promise<string> {
  const reportQuery: ReportQuery = {
    type: request.reportType,
    month: request.month,
    quarter: request.quarter,
    year: request.year,
  };

  const [report, insights, healthSummary, financialHealth] = await Promise.all([
    reportsService.generate(userId, reportQuery).catch(() => null),
    aiInsightsService.getInsights(userId).catch(() => null),
    prisma.dailyWellnessLog
      .findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 30,
      })
      .then((logs) => ({
        recentLogs: logs,
        count: logs.length,
      }))
      .catch(() => null),
    financialHealthService.getSummary(userId).catch(() => null),
  ]);

  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      dataQuality: {
        missingSections: [
          ...(report ? [] : ["report"]),
          ...(insights ? [] : ["insights"]),
          ...(healthSummary ? [] : ["healthData"]),
          ...(financialHealth ? [] : ["financialHealth"]),
        ],
      },
      report,
      insights,
      healthData: healthSummary,
      financialHealth,
    },
    null,
    0
  );
}

export const aiReportService = {
  async improve(userId: string, request: AiReportImproveRequest): Promise<AiReportImproveResponse> {
    if (!env.GROQ_API_KEY) {
      throw AppError.badRequest(
        "AI report improvement isn't configured yet. Add a free GROQ_API_KEY (https://console.groq.com/keys) to the backend .env file to enable it."
      );
    }

    const context = await buildReportContext(userId, request);

    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT + context }],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error("Groq API error:", response.status, body);
      throw AppError.badRequest("Failed to generate AI improvements. Please try again shortly.");
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw AppError.badRequest("The AI couldn't generate recommendations. Please try again.");
    }

    // Parse the JSON response from Groq
    try {
      // Remove markdown code blocks if present
      const cleanedContent = content
        .replace(/^```json\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      
      const result = JSON.parse(cleanedContent) as AiReportImproveResponse;
      const allowedLinks = new Set(["/expenses", "/investments", "/goals", "/banks", "/analytics", "/budgets", "/financial-health", "/investment-comparison"]);
      const sanitizeImprovement = (improvement: AiReportImproveResponse["topImprovements"][number]) => ({
        ...improvement,
        supportingDataLink: improvement.supportingDataLink && allowedLinks.has(improvement.supportingDataLink) ? improvement.supportingDataLink : undefined,
        actionLink: improvement.actionLink && allowedLinks.has(improvement.actionLink) ? improvement.actionLink : undefined,
      });
      result.topImprovements = result.topImprovements.map(sanitizeImprovement);
      result.financialImprovements = result.financialImprovements.map(sanitizeImprovement);
      result.healthImprovements = result.healthImprovements.map(sanitizeImprovement);
      result.timeImprovements = result.timeImprovements.map(sanitizeImprovement);

      // Validate the response has required fields
      if (
        !result.summary ||
        !result.topImprovements ||
        !result.finalRecommendation ||
        typeof result.overallScore !== "number"
      ) {
        throw new Error("Missing required fields in AI response");
      }

      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to parse AI response:", error, "Content:", content);
      throw AppError.badRequest(
        "The AI generated an invalid response. Please try again."
      );
    }
  },
};
