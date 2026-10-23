/**
 * AI-assisted fallback for lab report extraction, used only when the regex parser (lab-
 * report.parser.ts) finds nothing — e.g. a layout too inconsistent for any per-line pattern to
 * handle. Reuses the same free-tier Groq chat-completions API already wired up for the AI Chat
 * Assistant (ai-chat.service.ts). The patient-info header block is stripped before the request is
 * sent (see stripPatientHeaderBlock) so no name/age/gender/doctor/address ever leaves the server —
 * only the test-result table text does. Like the regex parser, every row returned here still goes
 * through the same user review/edit/delete flow before being relied upon.
 */
import { z } from "zod";
import { env } from "../../config/env";
import { ParsedLabResult, stripPatientHeaderBlock } from "./lab-report.parser";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

// Keep the request bounded in size/cost regardless of how many pages the report has.
const MAX_INPUT_CHARS = 12000;

const SYSTEM_PROMPT = `You extract lab test result rows from raw text taken from a diagnostic lab report PDF/image.
The text was pulled out by a generic text extractor, so column order/spacing may be scrambled and
notes/interpretation paragraphs may be mixed in with the actual results table.

Return ONLY a JSON object of the shape {"results": [{"testName": string, "value": number, "unit": string | null,
"referenceLow": number | null, "referenceHigh": number | null}]}.

Rules:
- Only include an entry if it is an actual lab test result with a numeric value.
- Never include section/panel titles, table headers, method notes, free-text interpretation
  paragraphs, or reference-range legends as rows.
- referenceLow/referenceHigh are the normal range for that test, if stated (either bound may be
  omitted if the report only gives one side, e.g. "<35").
- If nothing in the text looks like a lab result, return {"results": []}.`;

const aiResultSchema = z.object({
  results: z.array(
    z.object({
      testName: z.string().min(1).max(150),
      value: z.number(),
      unit: z.string().max(30).nullish(),
      referenceLow: z.number().nullish(),
      referenceHigh: z.number().nullish(),
    })
  ),
});

export async function parseLabReportTextWithAI(rawText: string): Promise<ParsedLabResult[]> {
  if (!env.GROQ_API_KEY) return [];

  const cleaned = stripPatientHeaderBlock(rawText).trim().slice(0, MAX_INPUT_CHARS);
  if (!cleaned) return [];

  const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: cleaned },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.error("Groq API error (lab report AI fallback):", response.status, body);
    return [];
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return [];

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return [];
  }

  const validated = aiResultSchema.safeParse(json);
  if (!validated.success) return [];

  return validated.data.results.map((r) => ({
    testName: r.testName,
    value: r.value,
    unit: r.unit ?? undefined,
    referenceLow: r.referenceLow ?? undefined,
    referenceHigh: r.referenceHigh ?? undefined,
  }));
}
