import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { aiInsightsService } from "../ai-insights/ai-insights.service";
import { taxDashboardService } from "../tax/tax-dashboard.service";
import { taxRulesService } from "../tax/tax-rules.service";
import { expensesService } from "../expenses/expenses.service";
import { createExpenseSchema } from "../expenses/expenses.dto";
import { incomeService } from "../income/income.service";
import { createIncomeSchema } from "../income/income.dto";
import { goalsService } from "../goals/goals.service";
import { createGoalSchema } from "../goals/goals.dto";
import { ChatMessageInput, ConfirmActionInput } from "./ai-chat.dto";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

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
- You can also take actions on the user's behalf — logging an expense, logging income, or creating a
  savings goal — by calling the matching tool when the user clearly asks for it (e.g. "add a ₹500 food
  expense today", "log my salary of ₹80000", "create a goal to save ₹200000 for a vacation by Dec 2026").
  Only call a tool when the user's intent to create that specific record is unambiguous; otherwise ask a
  clarifying question in plain text instead. Never call a tool just to look something up.

User's financial data snapshot (JSON):
`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_expense",
      description: "Log a new expense for the user.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO date (YYYY-MM-DD) the expense occurred. Defaults to today if omitted." },
          category: {
            type: "string",
            enum: ["FOOD", "RENT", "FUEL", "SHOPPING", "TRAVEL", "ENTERTAINMENT", "MEDICAL", "BILLS", "EMI", "INSURANCE", "EDUCATION", "OTHERS"],
          },
          amount: { type: "number", description: "Expense amount in INR." },
          paymentMode: {
            type: "string",
            enum: ["CASH", "CREDIT_CARD", "DEBIT_CARD", "UPI", "NET_BANKING", "BANK_TRANSFER", "OTHER"],
          },
          description: { type: "string" },
        },
        required: ["category", "amount", "paymentMode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_income",
      description: "Log a new income entry for the user.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO date (YYYY-MM-DD) the income was received. Defaults to today if omitted." },
          source: {
            type: "string",
            enum: ["SALARY", "FREELANCING", "INTEREST", "DIVIDEND", "RENTAL_INCOME", "OTHER_INCOME"],
          },
          amount: { type: "number", description: "Income amount in INR." },
          description: { type: "string" },
        },
        required: ["source", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_goal",
      description: "Create a new savings goal for the user.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short name for the goal." },
          type: {
            type: "string",
            enum: ["EMERGENCY_FUND", "HOUSE", "CAR", "VACATION", "RETIREMENT", "CHILD_EDUCATION", "CUSTOM"],
          },
          targetAmount: { type: "number", description: "Target amount in INR." },
          currentAmount: { type: "number", description: "Amount already saved towards this goal, defaults to 0." },
          deadline: { type: "string", description: "ISO date (YYYY-MM-DD) by which the goal should be reached." },
        },
        required: ["name", "type", "targetAmount", "deadline"],
      },
    },
  },
] as const;

const ACTION_LABELS: Record<string, string> = {
  create_expense: "Log this expense",
  create_income: "Log this income",
  create_goal: "Create this savings goal",
};

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

interface GroqToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export const aiChatService = {
  async sendMessage(userId: string, input: ChatMessageInput): Promise<{ reply: string | null; proposedAction?: { action: string; label: string; arguments: Record<string, unknown> } }> {
    if (!env.GROQ_API_KEY) {
      throw AppError.badRequest(
        "AI chat isn't configured yet. Add a free GROQ_API_KEY (https://console.groq.com/keys) to the backend .env file to enable it."
      );
    }

    const setting = await prisma.setting.findUnique({ where: { userId }, select: { aiChatEnabled: true } });
    if (setting?.aiChatEnabled === false) {
      throw AppError.badRequest("AI Chat is turned off in Settings — enable it under Settings \u2192 AI to use this feature.");
    }

    const context = await buildFinancialContext(userId);

    const history = (input.history ?? []).map((h) => ({
      role: h.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: h.text,
    }));

    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + context },
          ...history,
          { role: "user", content: input.message },
        ],
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.4,
        max_tokens: 700,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error("Groq API error:", response.status, body);
      throw AppError.badRequest("The AI assistant is temporarily unavailable. Please try again shortly.");
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string; tool_calls?: GroqToolCall[] } }[];
    };
    const message = data.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.[0];

    if (toolCall) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        // fall through with empty args — the confirmation UI will surface the issue on submit
      }
      return {
        reply: message?.content?.trim() || null,
        proposedAction: {
          action: toolCall.function.name,
          label: ACTION_LABELS[toolCall.function.name] ?? "Confirm this action",
          arguments: args,
        },
      };
    }

    const reply = message?.content?.trim();
    if (!reply) {
      throw AppError.badRequest("The AI assistant couldn't generate a response. Please try rephrasing your question.");
    }

    return { reply };
  },

  /**
   * Generates an automatic AI answer for a user's "doubt/question" helpdesk ticket. Reuses the same
   * financial-context grounding as the chat widget but skips tool-calling (a ticket doubt is a plain
   * Q&A, not an action request). Returns `null` instead of throwing if AI isn't configured or the
   * call fails, so ticket creation always succeeds even when the AI is unavailable.
   */
  async answerDoubt(userId: string, question: string): Promise<string | null> {
    if (!env.GROQ_API_KEY) return null;

    try {
      const context = await buildFinancialContext(userId);
      const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.GROQ_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT + context },
            { role: "user", content: question },
          ],
          temperature: 0.4,
          max_tokens: 700,
        }),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch {
      return null;
    }
  },

  /** Executes a tool-call action after the user has explicitly confirmed it in the UI. */
  async confirmAction(userId: string, input: ConfirmActionInput): Promise<{ message: string }> {
    const today = new Date().toISOString().slice(0, 10);

    switch (input.action) {
      case "create_expense": {
        const parsed = createExpenseSchema.parse({ date: today, ...input.arguments });
        await expensesService.create(userId, parsed);
        return { message: "Expense logged successfully." };
      }
      case "create_income": {
        const parsed = createIncomeSchema.parse({ date: today, ...input.arguments });
        await incomeService.create(userId, parsed);
        return { message: "Income logged successfully." };
      }
      case "create_goal": {
        const parsed = createGoalSchema.parse(input.arguments);
        await goalsService.create(userId, parsed);
        return { message: "Goal created successfully." };
      }
      default:
        throw AppError.badRequest("Unknown action.");
    }
  },
};

