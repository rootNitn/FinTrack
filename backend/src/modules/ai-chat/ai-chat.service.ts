import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { aiInsightsService } from "../ai-insights/ai-insights.service";
import { taxDashboardService } from "../tax/tax-dashboard.service";
import { taxRulesService } from "../tax/tax-rules.service";
import { ChatMessageInput } from "./ai-chat.dto";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PROMPT = `You are the built-in AI Assistant inside a personal finance & investment tracking app for a
single user in India. You are given a JSON snapshot of that user's REAL financial data (spending trends,
investment portfolio, savings opportunities, budget status, goals, and tax situation) below. Use ONLY this
data to answer — never invent numbers that aren't present in it. If the data needed to answer isn't
available (e.g. no tax calculation saved yet, or no investments recorded), say so plainly and suggest which
screen in the app the user should fill in first (Tax Calculator, Investments, Budgets, Goals, etc.).

Guidelines:
- Answer in 2-6 short sentences unless the user clearly wants a longer breakdown. Use ₹ for currency.
- For tax/investment/retirement questions, give practical, general guidance grounded in the provided
  numbers — but always add a brief note that this is not professional financial/tax advice.
- Be direct and conversational, not robotic. No unnecessary disclaimers beyond the one above.
- If asked something unrelated to personal finance, gently redirect to what you can help with.

User's financial data snapshot (JSON):
`;

async function buildFinancialContext(userId: string): Promise<string> {
  const [insights, taxDashboard] = await Promise.all([
    aiInsightsService.getInsights(userId).catch(() => null),
    taxRulesService
      .getDefaultFinancialYearCode()
      .then((fy) => taxDashboardService.getDashboard(userId, fy))
      .catch(() => null),
  ]);

  return JSON.stringify({ insights, tax: taxDashboard }, null, 0);
}

export const aiChatService = {
  async sendMessage(userId: string, input: ChatMessageInput): Promise<{ reply: string }> {
    if (!env.GEMINI_API_KEY) {
      throw AppError.badRequest(
        "AI chat isn't configured yet. Add a free GEMINI_API_KEY (https://aistudio.google.com/apikey) to the backend .env file to enable it."
      );
    }

    const context = await buildFinancialContext(userId);

    const history = (input.history ?? []).map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.text }],
    }));

    const url = `${GEMINI_API_BASE}/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT + context }] },
        contents: [...history, { role: "user", parts: [{ text: input.message }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error("Gemini API error:", response.status, body);
      throw AppError.badRequest("The AI assistant is temporarily unavailable. Please try again shortly.");
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();

    if (!reply) {
      throw AppError.badRequest("The AI assistant couldn't generate a response. Please try rephrasing your question.");
    }

    return { reply };
  },
};
