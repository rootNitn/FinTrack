import { z } from "zod";

export const ticketTypeEnum = z.enum(["ERROR", "SUGGESTION", "DOUBT"]);
export const ticketStatusEnum = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);

export const createTicketSchema = z.object({
  type: ticketTypeEnum,
  subject: z.string().min(1, "Subject is required").max(200),
  description: z.string().min(1, "Description is required").max(5000),
  /** Optional structured context for ERROR tickets — e.g. stack trace, URL, browser/app version. */
  errorContext: z.record(z.any()).optional(),
});

export const updateTicketAdminSchema = z.object({
  status: ticketStatusEnum.optional(),
  adminResponse: z.string().max(5000).optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketAdminInput = z.infer<typeof updateTicketAdminSchema>;
