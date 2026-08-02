import { z } from "zod";

export const chatMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000),
  // Short rolling history the client keeps for conversational context — capped to keep
  // the prompt (and token cost) small; the server is otherwise stateless per request.
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(2000),
      })
    )
    .max(10)
    .optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
